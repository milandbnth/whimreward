
import session from "express-session";
import { getWhimdbPool } from "./oracle-client.js";
import oracledb from "oracledb";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class OracleSessionStore extends session.Store {
  async get(sid, callback) {
    try {
      const pool = await getWhimdbPool();
      const connection = await pool.getConnection();

      try {
        const result = await connection.execute(
          `SELECT sess
           FROM user_sessions
           WHERE sid = :sid
             AND expire > SYSTIMESTAMP`,
          { sid },
           {
            fetchInfo: {
              SESS: { type: oracledb.STRING }
            }
          }
        );

        if (result.rows.length === 0) {
          callback(null, null);
          return;
        }

        const raw = result.rows[0][0];
        callback(null, typeof raw === "string" ? JSON.parse(raw) : raw);
      } finally {
        await connection.close();
      }
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, sess, callback = () => { }) {
    try {
      const pool = await getWhimdbPool();
      const connection = await pool.getConnection();

      try {
        const expiresAt = sess.cookie?.expires
          ? new Date(sess.cookie.expires)
          : new Date(Date.now() + ONE_DAY_MS);

        await connection.execute(
          `MERGE INTO user_sessions target
           USING (SELECT :sid AS sid FROM dual) source
           ON (target.sid = source.sid)
           WHEN MATCHED THEN UPDATE SET
             target.sess = :sess,
             target.expire = :expire
           WHEN NOT MATCHED THEN INSERT (sid, sess, expire)
             VALUES (:sid, :sess, :expire)`,
          {
            sid,
            sess: JSON.stringify(sess),
            expire: expiresAt
          },
          { autoCommit: true }
        );
      } finally {
        await connection.close();
      }

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback = () => { }) {
    try {
      const pool = await getWhimdbPool();
      const connection = await pool.getConnection();

      try {
        await connection.execute(
          `DELETE FROM user_sessions WHERE sid = :sid`,
          { sid },
          { autoCommit: true }
        );
      } finally {
        await connection.close();
      }

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid, sess, callback = () => { }) {
    try {
      const pool = await getWhimdbPool();
      const connection = await pool.getConnection();

      try {
        const expiresAt = sess.cookie?.expires
          ? new Date(sess.cookie.expires)
          : new Date(Date.now() + ONE_DAY_MS);

        await connection.execute(
          `UPDATE user_sessions
           SET expire = :expire
           WHERE sid = :sid`,
          { sid, expire: expiresAt },
          { autoCommit: true }
        );
      } finally {
        await connection.close();
      }

      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}
