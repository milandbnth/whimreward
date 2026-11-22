
const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");

const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const loginButton = document.querySelector("#login-button");

const employeeName = document.querySelector("#employee-name");
const employeeEmail = document.querySelector("#employee-email");

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#customer-search");
const searchButton = document.querySelector("#search-button");
const customerList = document.querySelector("#customer-list");
const searchMessage = document.querySelector("#search-message");

const customerWorkspace = document.querySelector("#customer-workspace");
const selectedCustomerName = document.querySelector("#selected-customer-name");
const selectedCustomerEmail = document.querySelector("#selected-customer-email");
const selectedCustomerBalance = document.querySelector("#selected-customer-balance");
const transactionHistory = document.querySelector("#transaction-history");

const transactionForm = document.querySelector("#transaction-form");
const transactionType = document.querySelector("#transaction-type");
const transactionAmount = document.querySelector("#transaction-amount");
const transactionReason = document.querySelector("#transaction-reason");
const transactionReference = document.querySelector("#transaction-reference");
const postButton = document.querySelector("#post-button");
const transactionMessage = document.querySelector("#transaction-message");

const logoutButton = document.querySelector("#logout-button");

let selectedCustomer = null;
let customers = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    showLogin();
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function setMessage(element, message, kind = "error") {
  element.textContent = message;
  element.className = `notice ${kind}`;
}

function showLogin() {
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  selectedCustomer = null;
}

function showApp(user) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  employeeName.textContent = user.name;
  employeeEmail.textContent = user.email;
}

async function loadSession() {
  try {
    const data = await api("/auth/me");
    showApp(data.user);
    await searchCustomers("");
  } catch {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  setMessage(loginMessage, "");

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#login-email").value.trim(),
        password: document.querySelector("#login-password").value
      })
    });

    loginForm.reset();
    showApp(data.user);
    await searchCustomers("");
  } catch (error) {
    setMessage(loginMessage, error.message);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await api("/auth/logout", { method: "POST" });
  } catch (error) {
    setMessage(searchMessage, error.message);
  } finally {
    showLogin();
    logoutButton.disabled = false;
    loginForm.reset();
  }
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await searchCustomers(searchInput.value.trim());
});

async function searchCustomers(search) {
  searchButton.disabled = true;
  setMessage(searchMessage, "");
  customerList.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "empty";
  loading.textContent = "Searching customers…";
  customerList.append(loading);

  try {
    const data = await api(`/customers?search=${encodeURIComponent(search)}`);
    customers = data.customers;

    customerList.replaceChildren();

    if (customers.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No customers found.";
      customerList.append(empty);
      return;
    }

    for (const customer of customers) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "customer-card";

      const name = document.createElement("div");
      name.className = "customer-name";
      name.textContent = customer.name;

      const email = document.createElement("div");
      email.className = "customer-email";
      email.textContent = customer.email || "No email";

      const balance = document.createElement("div");
      balance.className = "balance";
      balance.textContent = Number(customer.balance).toLocaleString();

      const label = document.createElement("div");
      label.className = "balance-label";
      label.textContent = "Reward points";

      card.append(name, email, balance, label);

      if (selectedCustomer?.id === customer.id) {
        card.classList.add("selected");
      }

      card.addEventListener("click", () => selectCustomer(customer));
      customerList.append(card);
    }
  } catch (error) {
    customerList.replaceChildren();
    setMessage(searchMessage, error.message);
  } finally {
    searchButton.disabled = false;
  }
}

async function selectCustomer(customer) {
  selectedCustomer = customer;
  customerWorkspace.classList.remove("hidden");
  selectedCustomerName.textContent = customer.name;
  selectedCustomerEmail.textContent = customer.email || "No email on file";
  selectedCustomerBalance.textContent = Number(customer.balance).toLocaleString();
  setMessage(transactionMessage, "");

  for (const card of customerList.querySelectorAll(".customer-card")) {
    card.classList.remove("selected");
  }

  const selectedCard = [...customerList.querySelectorAll(".customer-card")]
    .find((card) => card.querySelector(".customer-name")?.textContent === customer.name);

  selectedCard?.classList.add("selected");

  await refreshCustomer();
}

async function refreshCustomer() {
  if (!selectedCustomer) return;

  const customerId = selectedCustomer.id;
  transactionHistory.textContent = "Loading transaction history…";

  try {
    const [customerData, balanceData, historyData] = await Promise.all([
      api(`/customers/${customerId}`),
      api(`/customers/${customerId}/balance`),
      api(`/customers/${customerId}/transactions`)
    ]);

    if (selectedCustomer?.id !== customerId) return;

    selectedCustomer = {
      ...customerData,
      balance: balanceData.balance
    };

    selectedCustomerName.textContent = customerData.name;
    selectedCustomerEmail.textContent = customerData.email || "No email on file";
    selectedCustomerBalance.textContent = Number(balanceData.balance).toLocaleString();

    renderHistory(historyData.transactions);
    await searchCustomers(searchInput.value.trim());
  } catch (error) {
    transactionHistory.textContent = "";
    setMessage(transactionMessage, error.message);
  }
}

function renderHistory(transactions) {
  transactionHistory.replaceChildren();

  if (transactions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No transactions recorded for this customer.";
    transactionHistory.append(empty);
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  for (const label of ["Date", "Type", "Points", "Reason"]) {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.append(th);
  }

  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement("tbody");

  for (const transaction of [...transactions].reverse()) {
    const row = document.createElement("tr");

    const date = document.createElement("td");
    date.textContent = new Date(transaction.posted_at).toLocaleString();

    const type = document.createElement("td");
    type.textContent = transaction.type;

    const amount = document.createElement("td");
    amount.textContent = `${transaction.amount > 0 ? "+" : ""}${transaction.amount}`;
    amount.className = transaction.amount > 0
      ? "points-positive"
      : "points-negative";

    const reason = document.createElement("td");
    reason.textContent = transaction.reason;

    row.append(date, type, amount, reason);
    tbody.append(row);
  }

  table.append(tbody);
  transactionHistory.append(table);
}

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedCustomer) {
    setMessage(transactionMessage, "Select a customer first.");
    return;
  }

  const points = Number(transactionAmount.value);

  if (!Number.isSafeInteger(points) || points <= 0) {
    setMessage(transactionMessage, "Enter a positive whole number of points.");
    return;
  }

  const type = transactionType.value;
  const amount = type === "redemption" ? -points : points;
  const reason = transactionReason.value.trim();

  if (!reason) {
    setMessage(transactionMessage, "A reason is required.");
    return;
  }

  postButton.disabled = true;
  setMessage(transactionMessage, "Posting transaction…", "muted");

  try {
    await api("/transactions", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify({
        customerId: selectedCustomer.id,
        amount,
        type,
        reason,
        reference: transactionReference.value.trim() || null
      })
    });

    transactionForm.reset();
    setMessage(transactionMessage, "Transaction posted successfully.", "success");
    await refreshCustomer();
  } catch (error) {
    setMessage(transactionMessage, error.message);
  } finally {
    postButton.disabled = false;
  }
});

loadSession();
