const express = require("express");
const router = express.Router();
const db = require("../db"); // MySQL connection pool

// Save or update user role permissions
router.post("/save-user-roles", async (req, res) => {
  const { user_type, permissions } = req.body;

  if (!user_type || !permissions) {
    return res.status(400).json({ message: "user_type and permissions are required" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // ✅ Step 1: Insert user type if not exists
    const [userTypeRows] = await connection.query(
      `SELECT id FROM usertype WHERE user_type = ?`,
      [user_type]
    );

    let userTypeId;
    if (userTypeRows.length === 0) {
      const [insertUserType] = await connection.query(
        `INSERT INTO usertype (user_type) VALUES (?)`,
        [user_type]
      );
      userTypeId = insertUserType.insertId;
    } else {
      userTypeId = userTypeRows[0].id;
    }

    // ✅ Step 2: Insert or update each menu permission
    for (const [menu_name, perms] of Object.entries(permissions)) {
      await connection.query(
        `
        INSERT INTO userrolepermissions 
          (user_type_id, user_type, menu_name, can_add, can_modify, can_delete, can_view, can_print)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          can_add = VALUES(can_add),
          can_modify = VALUES(can_modify),
          can_delete = VALUES(can_delete),
          can_view = VALUES(can_view),
          can_print = VALUES(can_print)
        `,
        [
          userTypeId,
          user_type,
          menu_name,
          perms.add ? 1 : 0,
          perms.modify ? 1 : 0,
          perms.delete ? 1 : 0,
          perms.view ? 1 : 0,
          perms.print ? 1 : 0,
        ]
      );
    }

    await connection.commit();
    res.status(200).json({ message: "User roles saved/updated successfully!" });
  } catch (err) {
    await connection.rollback();
    console.error("Error saving user roles:", err);
    res.status(500).json({ message: "Error saving user roles", error: err.message });
  } finally {
    connection.release();
  }
});

// Get user type list
router.get("/usertypes", async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM usertype ORDER BY user_type ASC`);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching user types:", err);
    res.status(500).json({ message: "Error fetching user types", error: err.message });
  }
});

// Get permissions by user_type_id
router.get("/permissions/:user_type_id", async (req, res) => {
  const { user_type_id } = req.params;

  if (!user_type_id) {
    return res.status(400).json({ message: "user_type_id is required" });
  }

  try {
    const [rows] = await db.query(
      `SELECT menu_name, can_add, can_modify, can_delete, can_view, can_print 
       FROM userrolepermissions 
       WHERE user_type_id = ?`,
      [user_type_id]
    );

    // Convert to same structure as frontend expects
    const permissions = {};
    rows.forEach((row) => {
      permissions[row.menu_name] = {
        add: !!row.can_add,
        modify: !!row.can_modify,
        delete: !!row.can_delete,
        view: !!row.can_view,
        print: !!row.can_print,
      };
    });

    res.status(200).json({ permissions });
  } catch (err) {
    console.error("Error fetching permissions:", err);
    res.status(500).json({ message: "Error fetching permissions", error: err.message });
  }
});


module.exports = router;
