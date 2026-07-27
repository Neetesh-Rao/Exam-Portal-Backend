import { Router, Request, Response } from "express";
import { User } from "../models/User.js";
import { Candidate } from "../models/Candidate.js";
import { comparePassword, hashPassword, generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../lib/auth.js";
import { authenticateUser, AuthRequest } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    let user = await User.findOne({ email });
    if (!user) {
      // Check Candidate model for test-taker login
      const candidateDoc = await Candidate.findOne({ email });
      if (candidateDoc) {
        const accessToken = generateAccessToken({
          userId: candidateDoc._id.toString(),
          role: "candidate",
          companyId: candidateDoc.companyId?.toString() || null,
        });
        const refreshToken = generateRefreshToken({ userId: candidateDoc._id.toString() });

        res.cookie("access_token", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 2 * 1000,
          path: "/",
        });
        res.cookie("refresh_token", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7 * 1000,
          path: "/",
        });

        return res.json({
          user: {
            id: candidateDoc._id,
            name: candidateDoc.name,
            email: candidateDoc.email,
            role: "candidate",
            companyId: candidateDoc.companyId,
          },
        });
      }

      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      companyId: user.companyId?.toString() || null,
    });
    const refreshToken = generateRefreshToken({ userId: user._id.toString() });

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 15 * 1000,
      path: "/",
    });
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7 * 1000,
      path: "/",
    });

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, companyName, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    let companyId = null;

    if (companyName) {
      const { Company } = await import("../models/Company.js");
      const company = await Company.create({
        name: companyName,
        plan: "free",
      });
      companyId = company._id;
    }

    const userRole = role === "candidate" ? "candidate" : "admin";

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: userRole,
      companyId,
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      companyId: user.companyId?.toString() || null,
    });
    const refreshToken = generateRefreshToken({ userId: user._id.toString() });

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 15 * 1000,
      path: "/",
    });
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7 * 1000,
      path: "/",
    });

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  return res.json({ message: "Logged out" });
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) return res.status(401).json({ error: "No refresh token" });

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return res.status(401).json({ error: "Invalid refresh token" });

  const user = await User.findById(payload.userId);
  if (!user) return res.status(401).json({ error: "User not found" });

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
    companyId: user.companyId?.toString() || null,
  });

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15 * 1000,
    path: "/",
  });

  return res.json({ message: "Token refreshed" });
});

export default router;
