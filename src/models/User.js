const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: [true, "Name is required"], trim: true },
    email:    { type: String, required: [true, "Email is required"], unique: true, trim: true, lowercase: true },
    phone:    { type: String, trim: true, default: "" },
    password: { type: String, required: [true, "Password is required"], minlength: [6, "Min 6 characters"] },
    role:     { type: String, enum: ["admin", "staff"], default: "admin" },
    isVerified: { type: Boolean, default: false },
    otp:        { type: String, default: null },
    otpExpiry:  { type: Date,   default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);
