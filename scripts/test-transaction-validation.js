
import readline from "node:readline";
import { stdin, stdout } from "node:process";

const rl = readline.createInterface({ input: stdin, output: stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    let value = "";

    function onData(key) {
      const char = key.toString();

      if (char === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        process.exit(1);
      }

      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(value);
        return;
      }

      if (char === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    }

    stdin.on("data", onData);
  });
}

try {
  const email = (await ask("Employee email: ")).trim();
  const password = await askHidden("Employee password: ");

  const loginResponse = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const loginData = await loginResponse.json();

  if (!loginResponse.ok) {
    throw new Error(`Login failed (${loginResponse.status})`);
  }

  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];

  if (!cookie) {
    throw new Error("Login succeeded but no session cookie was returned");
  }

  const response = await fetch("http://localhost:3000/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify({
      customerId: "90842664-9ee2-4353-ad1f-cecad8855e59",
      amount: 5,
      type: "redemption",
      reason: "Validation test - must be rejected",
      reference: `VALIDATION-TEST-${Date.now()}`
    })
  });

  const data = await response.json();

  console.log("Invalid redemption HTTP status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  const passed =
    response.status === 400 &&
    data.error === "Redemption transactions must have a negative amount";

  console.log("Validation test:", passed ? "PASSED" : "FAILED");

  await fetch("http://localhost:3000/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie }
  });

  if (!passed) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
