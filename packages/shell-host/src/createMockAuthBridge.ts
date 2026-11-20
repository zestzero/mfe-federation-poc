import type { AuthBridge } from "@poc/session-coordinator";

const MOCK_SESSION_URL = "http://127.0.0.1:4010/api/session";

const ACCOUNT_OWNERS: Record<string, string> = {
  acct_north: "user_ava",
  acct_south: "user_beau",
};

/** Client-side simulated auth against fictional mock-api. Not production authentication. */
export function createMockAuthBridge(initialSubjectId = "user_ava"): AuthBridge {
  let subjectId = initialSubjectId;

  return {
    async login() {
      const response = await fetch(`${MOCK_SESSION_URL}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      if (!response.ok) throw new Error(`Fictional login failed (${response.status})`);
      const body = (await response.json()) as {
        session: { subjectId: string };
        account: { accountId: string };
      };
      subjectId = body.session.subjectId;
      return { subjectId: body.session.subjectId, accountId: body.account.accountId };
    },
    async logout() {
      const response = await fetch(`${MOCK_SESSION_URL}/logout`, { method: "POST" });
      if (!response.ok) throw new Error(`Fictional logout failed (${response.status})`);
    },
    async changeAccount(accountId: string) {
      const owner = ACCOUNT_OWNERS[accountId];
      if (!owner) throw new Error(`Unknown fictional account: ${accountId}`);
      // Each fictional account is owned by one fictional user; switching accounts switches subject.
      subjectId = owner;
      const response = await fetch(`${MOCK_SESSION_URL}/account`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId, accountId }),
      });
      if (!response.ok) throw new Error(`Fictional account change failed (${response.status})`);
      const body = (await response.json()) as { account: { accountId: string; ownerSubjectId: string } };
      subjectId = body.account.ownerSubjectId;
      return { subjectId: body.account.ownerSubjectId, accountId: body.account.accountId };
    },
  };
}
