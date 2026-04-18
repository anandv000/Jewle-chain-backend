const express = require("express");
const router  = express.Router();
const {
  getTeam, createMember, updateMember,
  resetMemberPassword, deleteMember, getPermissionsList,
} = require("../controllers/adminController");
const { protect, requireRole } = require("../middleware/auth");

router.use(protect, requireRole("admin", "host"));

router.get("/permissions",          getPermissionsList);
router.get("/team",                 getTeam);
router.post("/team",                createMember);
router.put("/team/:id",             updateMember);
router.patch("/team/:id/password",  resetMemberPassword);
router.delete("/team/:id",          deleteMember);

module.exports = router;
