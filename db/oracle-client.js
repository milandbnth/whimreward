import "dotenv/config";
import oracledb from "oracledb";

let whimdbPoolPromise;
let whimtrxPoolPromise;

function createOraclePool({
  label,
  userEnv,
  passwordEnv,
  connectStringEnv,
  walletDirEnv,
  walletPasswordEnv,
}) {
  const user = process.env[userEnv];
  const password = process.env[passwordEnv];
  const connectString = process.env[connectStringEnv];
  const walletDir = process.env[walletDirEnv];
  const walletPassword = process.env[walletPasswordEnv];

  const missing = [
    [userEnv, user],
    [passwordEnv, password],
    [connectStringEnv, connectString],
    [walletDirEnv, walletDir],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `${label} Oracle configuration missing: ${missing.join(", ")}`
    );
  }

  if (walletDir.startsWith("/path/to/")) {
    throw new Error(`${walletDirEnv} still contains an example placeholder`);
  }

  return oracledb.createPool({
    user,
    password,
    connectString,
    configDir: walletDir,
    walletLocation: walletDir,
    poolMin: 0,
    poolMax: 5,
    poolIncrement: 1,
    walletPassword,
  });
}

function getPool(currentPromise, setPromise, config) {
  if (!currentPromise) {
    currentPromise = createOraclePool(config);
    setPromise(
      currentPromise.catch((error) => {
        setPromise(undefined);
        throw error;
      })
    );
  }

  return currentPromise;
}

export function getWhimdbPool() {
  return getPool(whimdbPoolPromise, (promise) => {
    whimdbPoolPromise = promise;
  }, {
    label: "whimdb",
    userEnv: "WHIMDB_USER",
    passwordEnv: "WHIMDB_PASSWORD",
    connectStringEnv: "WHIMDB_CONNECT_STRING",
    walletDirEnv: "WHIMDB_WALLET_DIR",
    walletPasswordEnv: "WHIMDB_WALLET_PASSWORD",
  });
}

export function getWhimtrxPool() {
  return getPool(whimtrxPoolPromise, (promise) => {
    whimtrxPoolPromise = promise;
  }, {
    label: "whimtrx",
    userEnv: "WHIMTRX_USER",
    passwordEnv: "WHIMTRX_PASSWORD",
    connectStringEnv: "WHIMTRX_CONNECT_STRING",
    walletDirEnv: "WHIMTRX_WALLET_DIR",
    walletPasswordEnv: "WHIMTRX_WALLET_PASSWORD",
  });
}

export async function closeOraclePools() {
  const promises = [whimdbPoolPromise, whimtrxPoolPromise];
  whimdbPoolPromise = undefined;
  whimtrxPoolPromise = undefined;

  const pools = await Promise.all(
    promises.filter(Boolean).map((promise) => promise.catch(() => undefined))
  );

  await Promise.all(
    pools.filter(Boolean).map((pool) => pool.close(10))
  );
}
