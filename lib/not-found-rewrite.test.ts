// The case-study not-found rewrite (Story 3.2, proxy.ts). Next.js 16 sends a
// segment not-found page with an empty body, blank with JavaScript off, so
// the proxy rewrites every /experience/<slug> that is not a written case
// study, with status 404, to the static page at CASE_STUDY_NOT_FOUND_PATH,
// whose full HTML renders without script. That page's own URL 404s too.

import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";

import { writtenCaseStudySlugs } from "@/content/case-studies";
import { config, proxy } from "@/proxy";
import { CASE_STUDY_NOT_FOUND_PATH, caseStudyRewrite } from "./not-found-rewrite";

describe("caseStudyRewrite", () => {
  const written = ["offshore-delivery-turnaround"];

  test("a written slug passes through", () => {
    expect(caseStudyRewrite("/experience/offshore-delivery-turnaround", written)).toBeNull();
    expect(caseStudyRewrite("/experience/offshore-delivery-turnaround/", written)).toBeNull();
  });

  test("an unwritten or unknown slug goes to the not-found page", () => {
    expect(caseStudyRewrite("/experience/ai-native-engineering", written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
    expect(caseStudyRewrite("/experience/nope", written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
    expect(caseStudyRewrite("/experience/nope", [])).toBe(CASE_STUDY_NOT_FOUND_PATH);
  });

  test("an encoded written slug passes, a malformed escape is not found", () => {
    expect(caseStudyRewrite("/experience/offshore%2Ddelivery-turnaround", written)).toBeNull();
    expect(caseStudyRewrite("/experience/%E0%A4%A", written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
  });

  test("the not-found page's own URL is not found", () => {
    expect(caseStudyRewrite(CASE_STUDY_NOT_FOUND_PATH, written)).toBe(CASE_STUDY_NOT_FOUND_PATH);
  });

  test("other paths are left alone", () => {
    for (const path of ["/", "/experience", "/experience/", "/experience/a/b", "/projects/x"]) {
      expect(caseStudyRewrite(path, []), path).toBeNull();
    }
  });
});

describe("proxy", () => {
  const request = (path: string) => new NextRequest(new URL(path, "http://localhost"));

  test("rewrites an unwritten slug to the not-found page with status 404", () => {
    const slug = ["offshore-delivery-turnaround", "ai-native-engineering", "digital-governance-board"].find(
      (each) => !writtenCaseStudySlugs.includes(each),
    );
    const response = proxy(request(`/experience/${slug ?? "nope"}`));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(`http://localhost${CASE_STUDY_NOT_FOUND_PATH}`);
  });

  test("rewrites the not-found page's own URL with status 404", () => {
    const response = proxy(request(CASE_STUDY_NOT_FOUND_PATH));
    expect(response.status).toBe(404);
  });

  test("lets anything else through", () => {
    const response = proxy(request("/experience"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  test("runs only on case-study URLs and the not-found page", () => {
    expect(config.matcher).toEqual(["/experience/:slug", CASE_STUDY_NOT_FOUND_PATH]);
  });
});
