import { test } from "node:test";
import assert from "node:assert/strict";
import {
  afterWrongCode,
  failureTriggersLock,
  isCampusEmail,
  isStrongPassword,
  lockState,
  normalizePhone,
  resendWaitSec,
  type Attempt,
} from "./policy.js";

const fail = (at: number): Attempt => ({ success: false, locked: false, at });

test("allowed email domain: gmail only, no spoofing", () => {
  assert.ok(isCampusEmail(" Juan.Dela@GMAIL.com "));
  assert.ok(isCampusEmail("juan.dela+1@gmail.com"));
  for (const bad of [
    "a@omsc.edu.ph",
    "juan@omsu.edu.ph",
    "a@gmail.com.evil.com",
    "a@googlemail.com",
    "a@omsu.edu.ph.evil.com",
    "a@evil.com",
    "a b@omsu.edu.ph",
    "@omsu.edu.ph",
    "a@x.omsu.edu.ph",
    "a@omsu.edu.ph\n@evil.com",
  ])
    assert.equal(isCampusEmail(bad), false, bad);
});

test("password strength + phone", () => {
  assert.ok(isStrongPassword("Student@123"));
  assert.equal(isStrongPassword("student123"), false);
  assert.equal(isStrongPassword("Aa1!"), false);
  assert.equal(normalizePhone("0917 123 4567"), "+639171234567");
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone("12345"), null);
});

test("lockout: 5th failure in a minute locks for 60 s, then clears", () => {
  const now = 1_000_000;
  const four = [1, 2, 3, 4].map((i) => fail(now - i * 1000));
  assert.equal(failureTriggersLock(four, now), true);
  assert.equal(failureTriggersLock(four.slice(0, 3), now), false);
  const locked: Attempt = { success: false, locked: true, at: now };
  assert.deepEqual(lockState([locked, ...four], now + 10_000), { locked: true, retryAfterSec: 50 });
  assert.equal(lockState([locked], now + 60_000).locked, false);
});

test("lockout: a success resets the failure streak", () => {
  const now = 5_000_000;
  const recent: Attempt[] = [
    fail(now - 1000),
    { success: true, locked: false, at: now - 2000 },
    fail(now - 3000),
    fail(now - 4000),
    fail(now - 5000),
  ];
  assert.equal(failureTriggersLock(recent, now), false);
});

test("otp: 30 s resend and 5 attempts", () => {
  assert.equal(resendWaitSec(null, 0), 0);
  assert.equal(resendWaitSec(1000, 11_000), 20);
  assert.equal(resendWaitSec(1000, 40_000), 0);
  assert.deepEqual(afterWrongCode(0), { attempts: 1, left: 4, locked: false });
  assert.deepEqual(afterWrongCode(4), { attempts: 5, left: 0, locked: true });
  assert.equal(afterWrongCode(5).locked, true);
});
