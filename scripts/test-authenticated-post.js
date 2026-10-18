
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
      if (key.toString() === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        process.exit(1);
      }

      if (key.toString() === "\r" || key.toString() === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(value);
        return;
      }

      if (key.toString() === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += key.toString();
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
    throw new Error(`Login failed (${loginResponse.status}): ${JSON.stringify(loginData)}`);
  }

  const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];

  if (!cookie) {
    throw new Error("Login succeeded but no session cookie was returned");
  }

  const reference = `AUTH-POST-TEST-${Date.now()}`;

  const postResponse = await fetch("http://localhost:3000/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify({
      customerId: "90842664-9ee2-4353-ad1f-cecad8855e59",
      amount: 1,
      type: "reward",
      reason: "Authenticated route integration test",
      reference
    })
  });

  const postData = await postResponse.json();

  console.log("Login HTTP status:", loginResponse.status);
  console.log("Reward post HTTP status:", postResponse.status);
  console.log("Reward transaction:", JSON.stringify(postData, null, 2));
  console.log("Expected employee ID:", loginData.user.id);
  console.log("Actual posted_by:", postData.posted_by);
  console.log("Poster matches session:", postData.posted_by === loginData.user.id);
  console.log("Test reference:", reference);

  const logoutResponse = await fetch("http://localhost:3000/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie }
  });

  console.log("Logout HTTP status:", logoutResponse.status);
} catch (error) {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
