import readline from "node:readline";
import { stdin, stdout } from "node:process";

function ask(prompt) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return new Promise(resolve => rl.question(prompt, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Run this script in an interactive Git Bash terminal"));
      return;
    }

    stdout.write(prompt);
    let value = "";

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };

    const onData = key => {
      if (key === "\u0003") {
        cleanup();
        reject(new Error("Cancelled"));
      } else if (key === "\r" || key === "\n") {
        cleanup();
        resolve(value);
      } else if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
      } else if (key >= " ") {
        value += key;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}

try {
  const email = await ask("Employee email: ");
  const password = await askHidden("Employee password: ");

  const login = await fetch("http://localhost:3000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  console.log("Login HTTP status:", login.status);

  if (!login.ok) {
    console.log("Login response:", await login.text());
    process.exitCode = 1;
  } else {
    const cookie = login.headers.get("set-cookie")?.split(";")[0];

    if (!cookie) {
      throw new Error("Login succeeded but no session cookie was returned");
    }

    const me = await fetch("http://localhost:3000/auth/me", {
      headers: { Cookie: cookie }
    });

    console.log("Session check HTTP status:", me.status);
    if (me.ok) {
      const data = await me.json();
      console.log("Authenticated employee:", data.user.email);
    } else {
      console.log("Session check failed:", await me.text());
      process.exitCode = 1;
    }

    const logout = await fetch("http://localhost:3000/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie }
    });

    console.log("Logout HTTP status:", logout.status);
    console.log("Logout successful:", logout.ok);
  }
} catch (error) {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
}
