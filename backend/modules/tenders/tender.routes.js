const express = require("express");
const router = express.Router();

const tenderController = require("./tender.controller");

router.get("/", tenderController.getTenders);
router.post("/", tenderController.createTender);
router.put("/:id", tenderController.updateTender);
router.delete("/:id", tenderController.deleteTender);

module.exports = router;