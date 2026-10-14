// The not-found rewrite (Stories 3.2 and 3.5, proxy.ts). Next.js 16 sends a
// segment not-found page with an empty body, blank with JavaScript off, so
// the proxy rewrites every /experience/<slug> that is not a written case
// study, and every /projects/<slug> that is not a written project, with
// status 404, to its kind's static page in NOT_FOUND_PATH, whose full HTML
// renders without script. Each page's own URL 404s too.

import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";

import { writtenCaseStudySlugs } from "@/content/case-studies";
import { projects, writtenProjectSlugs } from "@/content/projects";
import { config, proxy } from "@/proxy";
import { CASE_STUDY_NOT_FOUND_PATH, NOT_FOUND_PATH, PROJECT_NOT_FOUND_PATH, notFoundRewrite } from "./not-found-rewrite";

describe("notFoundRewrite, case studies", () => {
  const written = { "case-study": ["offshore-delivery-turnaround"], project: [] };

  test("a written slug passes through", () => {
    expect(notFoundRewrite("/experience/offshore-delivery-turnaround", written)).toBeNull();
    expect(notFoundRewrite("/experience/offshore-delivery-turnaround/", written)).toBeNull();
  });

  test("an unwritten or unknown slug goes to the not-found page", () => {
    expect(notFoundRewrite("/experience/ai-native-engineering", written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
    expect(notFoundRewrite("/experience/nope", written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
    expect(notFoundRewrite("/experience/nope", { "case-study": [], project: [] })).toBe(CASE_STUDY_NOT_FOUND_PATH);
  });

  test("an encoded written slug passes, a malformed escape is not found", () => {
    expect(notFoundRewrite("/experience/offshore%2Ddelivery-turnaround", written)).toBeNull();
    expect(notFoundRewrite("/experience/%E0%A4%A", written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
  });

  test("the not-found page's own URL is not found", () => {
    expect(notFoundRewrite(CASE_STUDY_NOT_FOUND_PATH, written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
  });

  test("a project slug on the case-study list is still not a case study", () => {
    expect(notFoundRewrite("/projects/offshore-delivery-turnaround", written)).toBe(PROJECT_NOT_FOUND_PATH);
  });
});

describe("notFoundRewrite, projects", () => {
  const written = { "case-study": [], project: ["this-website"] };

  test("a written slug passes through", () => {
    expect(notFoundRewrite("/projects/this-website", written)).toBeNull();
    expect(notFoundRewrite("/projects/this-website/", written)).toBeNull();
    expect(notFoundRewrite("/projects/this%2Dwebsite", written)).toBeNull();
  });

  test("an unwritten, unknown or malformed slug goes to the project not-found page", () => {
    expect(notFoundRewrite("/projects/career-application-system", written)).toBe(PROJECT_NOT_FOUND_PATH);
    expect(notFoundRewrite("/projects/nope", written)).toBe(PROJECT_NOT_FOUND_PATH);
    expect(notFoundRewrite("/projects/%E0%A4%A", written)).toBe(PROJECT_NOT_FOUND_PATH);
    expect(notFoundRewrite("/experience/this-website", written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
  });

  test("the project not-found page's own URL is not found", () => {
    expect(notFoundRewrite(PROJECT_NOT_FOUND_PATH, written)).toBe(PROJECT_NOT_FOUND_PATH);
  });
});

describe("notFoundRewrite, everything else", () => {
  test("is left alone", () => {
    const none = { "case-study": [], project: [] };
    for (const path of ["/", "/experience", "/experience/", "/experience/a/b", "/projects", "/projects/", "/projects/a/b", "/contact", "/projectsx/a"]) {
      expect(notFoundRewrite(path, none), path).toBeNull();
    }
  });

  test("each kind has its own page", () => {
    expect(NOT_FOUND_PATH).toEqual({ "case-study": "/case-study-not-available", project: "/project-not-available" });
  });
});

describe("proxy", () => {
  const request = (path: string) => new NextRequest(new URL(path, "http://localhost"));

  test("rewrites an unwritten case study to its not-found page with status 404", () => {
    const slug = ["offshore-delivery-turnaround", "ai-native-engineering", "digital-governance-board"].find(
      (each) => !writtenCaseStudySlugs.includes(each),
    );
    const response = proxy(request(`/experience/${slug ?? "nope"}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(`http://localhost${CASE_STUDY_NOT_FOUND_PATH}`);
  });

  test("rewrites an unwritten or unknown project to the project not-found page with status 404", () => {
    const unwritten = projects.map((each) => each.slug).filter((slug) => !writtenProjectSlugs.includes(slug));
    for (const slug of [...unwritten, "nope"]) {
      const response = proxy(request(`/projects/${slug}`));
      expect(response.status, slug).toBe(404);
      expect(response.headers.get("x-middleware-rewrite"), slug).toBe(`http://localhost${PROJECT_NOT_FOUND_PATH}`);
    }
  });

  test.each([CASE_STUDY_NOT_FOUND_PATH, PROJECT_NOT_FOUND_PATH])("rewrites %s, the page's own URL, with status 404", (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(`http://localhost${path}`);
  });

  test.each(writtenCaseStudySlugs)("lets the written case study %s through", (slug) => {
    const response = proxy(request(`/experience/${slug}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  test("lets every written project through", () => {
    for (const slug of writtenProjectSlugs) {
      const response = proxy(request(`/projects/${slug}`));
      expect(response.headers.get("x-middleware-next"), slug).toBe("1");
      expect(response.headers.get("x-middleware-rewrite"), slug).toBeNull();
    }
  });

  test("lets anything else through", () => {
    for (const path of ["/experience", "/projects"]) {
      const response = proxy(request(path));
      expect(response.headers.get("x-middleware-rewrite"), path).toBeNull();
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
    }
  });

  test("runs only on detail URLs and the two not-found pages", () => {
    expect(config.matcher).toEqual(["/experience/:slug", CASE_STUDY_NOT_FOUND_PATH, "/projects/:slug", PROJECT_NOT_FOUND_PATH]);
  });
});
