const express = require("express");
const router  = express.Router();
const {
  hostLogin, setupHost, getAdmins, createAdmin, getAllUsers,
  toggleActive, resetPassword, deleteUser, updatePermissions,
} = require("../controllers/hostController");
const { protect, requireRole } = require("../middleware/auth");

// Public: host setup (DEVELOPMENT ONLY - remove in production)
router.get("/setup", setupHost);

// Public: host login (separate from regular login)
router.post("/login", hostLogin);

// All routes below require host role
router.use(protect, requireRole("host"));

router.get("/admins",                       getAdmins);
router.post("/admins",                      createAdmin);
router.get("/users",                        getAllUsers);
router.patch("/users/:id/toggle-active",    toggleActive);
router.patch("/users/:id/reset-password",   resetPassword);
router.patch("/users/:id/permissions",      updatePermissions);
router.delete("/users/:id",                 deleteUser);

module.exports = router;
