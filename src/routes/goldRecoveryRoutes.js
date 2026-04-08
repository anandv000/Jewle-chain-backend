const express = require("express");
const router  = express.Router();
const { getAll, create, remove } = require("../controllers/goldRecoveryController");

router.route("/").get(getAll).post(create);
router.route("/:id").delete(remove);

module.exports = router;
