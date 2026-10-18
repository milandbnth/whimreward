
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
    throw new Error("No session cookie was returned");
  }

  const searchResponse = await fetch(
    "http://localhost:3000/customers?search=Test",
    { headers: { Cookie: cookie } }
  );

  const searchData = await searchResponse.json();

  console.log("Login HTTP status:", loginResponse.status);
  console.log("Customer search HTTP status:", searchResponse.status);
  console.log(JSON.stringify(searchData, null, 2));

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
