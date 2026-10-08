// Tests for check-protection.mts. Run with: npm run test:scripts
//
// Every branch response is a fixture and the fetch is a fake, so no test
// touches GitHub.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  branchUrl,
  defaultFetch,
  main,
  parseBranch,
  protectionProblems,
  resolveRepo,
  type Branch,
  type Deps,
  type FetchImpl,
} from "./check-protection.mts";

const INTACT: Branch = {
  protected: true,
  protection: {
    enabled: true,
    required_status_checks: {
      enforcement_level: "everyone",
      contexts: ["gate"],
      checks: [{ context: "gate" }],
    },
  },
};

const withChecks = (over: Record<string, unknown>): Branch => ({
  ...INTACT,
  protection: { ...INTACT.protection, required_status_checks: { ...INTACT.protection!.required_status_checks, ...over } },
});

describe("protectionProblems", () => {
  test("intact protection has no problems", () => {
    assert.deepEqual(protectionProblems(INTACT), []);
  });

  test("an unprotected branch is named", () => {
    assert.deepEqual(protectionProblems({ protected: false, protection: { enabled: false } }), ["main is not protected"]);
    assert.deepEqual(protectionProblems({}), ["main is not protected"]);
  });

  test("protection without required status checks is named", () => {
    assert.deepEqual(protectionProblems({ protected: true, protection: { enabled: true } }), [
      "main requires no status checks",
    ]);
  });

  for (const level of ["non_admins", "off"]) {
    test(`enforcement "${level}" is named as exempting admins`, () => {
      const problems = protectionProblems(withChecks({ enforcement_level: level }));
      assert.equal(problems.length, 1);
      assert.match(problems[0], new RegExp(`"${level}", not "everyone", so admins are exempt`));
    });
  }

  test("gate missing from the required checks is named, with what is required instead", () => {
    const problems = protectionProblems(withChecks({ contexts: ["build"], checks: [{ context: "build" }] }));
    assert.deepEqual(problems, ["the required checks (build) do not include gate"]);
    assert.deepEqual(protectionProblems(withChecks({ contexts: [], checks: [] })), [
      "the required checks (none) do not include gate",
    ]);
  });

  test("gate counts whether it is listed in contexts or in checks", () => {
    assert.deepEqual(protectionProblems(withChecks({ contexts: [] })), []);
    assert.deepEqual(protectionProblems(withChecks({ checks: [] })), []);
  });

  test("a missing enforcement level is named", () => {
    const problems = protectionProblems(withChecks({ enforcement_level: undefined }));
    assert.deepEqual(problems, ['required status checks are enforced for "missing", not "everyone", so admins are exempt']);
  });

  test("protected with no protection object is named", () => {
    assert.deepEqual(protectionProblems({ protected: true }), ["main requires no status checks"]);
  });

  test("every drift is reported at once", () => {
    assert.equal(protectionProblems(withChecks({ enforcement_level: "off", contexts: [], checks: [] })).length, 2);
  });
});

describe("parseBranch", () => {
  test("the real shape parses, with or without protection", () => {
    assert.deepEqual(parseBranch(JSON.stringify(INTACT)), INTACT);
    assert.deepEqual(parseBranch('{"protected":false}'), { protected: false });
  });

  const bad: [string, string][] = [
    ["null", "not an object"],
    ["[]", "not an object"],
    ['"main"', "not an object"],
    ["{}", "protected is not a boolean"],
    ['{"protected":true,"protection":null}', "protection is not an object"],
    ['{"protected":true,"protection":[]}', "protection is not an object"],
    ['{"protected":true,"protection":{"required_status_checks":"gate"}}', "required_status_checks is not an object"],
    ['{"protected":true,"protection":{"required_status_checks":{"enforcement_level":1}}}', "enforcement_level is not a string"],
    ['{"protected":true,"protection":{"required_status_checks":{"contexts":"gate"}}}', "contexts is not a list"],
    ['{"protected":true,"protection":{"required_status_checks":{"checks":[null]}}}', "checks is not a list"],
  ];
  for (const [text, reason] of bad) {
    test(`${text} is rejected: ${reason}`, () => {
      assert.throws(() => parseBranch(text), new RegExp(`unexpected branch response: ${reason}`));
    });
  }
});

describe("resolveRepo", () => {
  test("GITHUB_REPOSITORY wins and the remote is not read", () => {
    assert.equal(
      resolveRepo({ GITHUB_REPOSITORY: "o/r" }, () => assert.fail("read origin")),
      "o/r",
    );
  });

  test("otherwise the origin remote, in any GitHub URL form", () => {
    assert.equal(resolveRepo({}, () => "https://github.com/o/r.git"), "o/r");
    assert.equal(resolveRepo({}, () => "git@github.com:o/r.git"), "o/r");
  });

  test("a GITHUB_REPOSITORY that is not owner/name gives none, without falling back to the remote", () => {
    for (const value of ["o", "o/r/x", "../o/r", "o/r?x=1"]) {
      assert.equal(
        resolveRepo({ GITHUB_REPOSITORY: value }, () => "https://github.com/o/r.git"),
        null,
      );
    }
  });

  test("no repository when the remote is missing or not GitHub", () => {
    assert.equal(resolveRepo({}, () => null), null);
    assert.equal(resolveRepo({}, () => "https://gitlab.com/o/r.git"), null);
  });
});

describe("main", () => {
  function deps(response: Branch | Error) {
    const err: string[] = [];
    const urls: string[] = [];
    const d: Deps = {
      env: { GITHUB_REPOSITORY: "o/r" },
      originUrl: () => null,
      fetchText: async (url) => {
        urls.push(url);
        if (response instanceof Error) throw response;
        return JSON.stringify(response);
      },
      err: (text) => err.push(text),
    };
    return { d, err, urls };
  }

  test("intact protection passes silently", async () => {
    const { d, err, urls } = deps(INTACT);
    assert.equal(await main(d), 0);
    assert.deepEqual(err, []);
    assert.deepEqual(urls, [branchUrl("o/r")]);
    assert.equal(urls[0], "https://api.github.com/repos/o/r/branches/main");
  });

  test("drift exits 1 and names it", async () => {
    const { d, err } = deps({ protected: false });
    assert.equal(await main(d), 1);
    assert.match(err.join(""), /main protection of o\/r has drifted:\n {2}- main is not protected/);
  });

  test("a failed request exits 1 visibly", async () => {
    const { d, err } = deps(new Error("HTTP 503"));
    assert.equal(await main(d), 1);
    assert.match(err.join(""), /could not read main protection of o\/r: HTTP 503/);
  });

  test("a malformed body exits 1 as could not read, not as drift", async () => {
    const { d, err } = deps(INTACT);
    d.fetchText = async () => "null";
    assert.equal(await main(d), 1);
    assert.match(err.join(""), /check-protection: could not read main protection of o\/r: unexpected branch response/);
  });

  test("no resolvable repository exits 1 before fetching", async () => {
    const { d, err, urls } = deps(INTACT);
    d.env = {};
    assert.equal(await main(d), 1);
    assert.deepEqual(urls, []);
    assert.match(err.join(""), /origin remote is missing/);
  });
});

describe("defaultFetch", () => {
  type Seen = { url: string; headers: Record<string, string> };

  function fake(responses: (Response | Error)[]) {
    const seen: Seen[] = [];
    const fetchImpl: FetchImpl = async (url, init) => {
      seen.push({ url, headers: init.headers as Record<string, string> });
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return next;
    };
    return { fetchImpl, seen };
  }

  const URL_API = "https://api.github.com/repos/o/r/branches/main";

  test("sends the token and the Accept header to api.github.com", async () => {
    const { fetchImpl, seen } = fake([new Response("{}")]);
    assert.equal(await defaultFetch(URL_API, { fetchImpl, token: "t0k", backoffMs: 0 }), "{}");
    assert.equal(seen[0].headers.Authorization, "Bearer t0k");
    assert.equal(seen[0].headers.Accept, "application/vnd.github+json");
  });

  test("never sends the token anywhere else", async () => {
    for (const url of ["https://example.test/x", "https://api.github.com.evil.test/x", "http://api.github.com/x"]) {
      const { fetchImpl, seen } = fake([new Response("{}")]);
      await defaultFetch(url, { fetchImpl, token: "t0k", backoffMs: 0 });
      assert.equal(seen[0].headers.Authorization, undefined, url);
    }
  });

  test("a non-OK status throws rather than returning the body", async () => {
    const { fetchImpl, seen } = fake([new Response('{"protected":true}', { status: 404 })]);
    await assert.rejects(defaultFetch(URL_API, { fetchImpl, backoffMs: 0 }), /HTTP 404/);
    assert.equal(seen.length, 1);
  });

  test("a 5xx or a network error is retried once", async () => {
    const flaky = fake([new Response("", { status: 502 }), new Response("ok")]);
    assert.equal(await defaultFetch(URL_API, { fetchImpl: flaky.fetchImpl, backoffMs: 0 }), "ok");
    const offline = fake([new TypeError("fetch failed"), new Response("ok")]);
    assert.equal(await defaultFetch(URL_API, { fetchImpl: offline.fetchImpl, backoffMs: 0 }), "ok");
  });

  test("a second failure throws", async () => {
    const down = fake([new Response("", { status: 503 }), new Response("", { status: 503 })]);
    await assert.rejects(defaultFetch(URL_API, { fetchImpl: down.fetchImpl, backoffMs: 0 }), /HTTP 503/);
    const offline = fake([new TypeError("fetch failed"), new TypeError("fetch failed")]);
    await assert.rejects(defaultFetch(URL_API, { fetchImpl: offline.fetchImpl, backoffMs: 0 }), /fetch failed/);
    assert.equal(offline.seen.length, 2);
  });

  test("through main, a non-OK status is a could not read failure", async () => {
    const { fetchImpl } = fake([new Response(JSON.stringify(INTACT), { status: 403 })]);
    const err: string[] = [];
    const code = await main({
      env: { GITHUB_REPOSITORY: "o/r" },
      originUrl: () => null,
      fetchText: (url) => defaultFetch(url, { fetchImpl, backoffMs: 0 }),
      err: (text) => err.push(text),
    });
    assert.equal(code, 1);
    assert.match(err.join(""), /could not read main protection of o\/r: .*HTTP 403/);
  });
});
