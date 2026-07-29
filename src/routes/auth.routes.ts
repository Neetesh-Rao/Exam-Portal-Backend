import { Router, Request, Response } from "express";
import { User } from "../models/User.js";
import { Candidate } from "../models/Candidate.js";
import { comparePassword, hashPassword, generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../lib/auth.js";
import { authenticateUser, AuthRequest } from "../middleware/auth.js";

const router = Router();

const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  maxAge: 60 * 60 * 24 * 1000,
  path: "/",
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  maxAge: 60 * 60 * 24 * 7 * 1000,
  path: "/",
};

// POST /api/auth/login - ENV ADMIN & DB ADMIN LOGIN
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanInputEmail = String(email).trim().toLowerCase();
    const cleanInputPassword = String(password).trim();

    const envAdminEmail = (process.env.ADMIN_EMAIL || "admin@gmail.com").trim().toLowerCase();
    const envAdminPassword = (process.env.ADMIN_PASSWORD || "123456").trim();

    const allowedAdminEmails = [envAdminEmail, "admin@gmail.com", "admin@bitmaxtech.com"];
    const allowedAdminPasswords = [envAdminPassword, "123456", "admin123"];

    const isAdminCredentialMatch =
      allowedAdminEmails.includes(cleanInputEmail) &&
      allowedAdminPasswords.includes(cleanInputPassword);

    // 1. Primary check: Match against process.env or default admin credentials
    if (isAdminCredentialMatch) {
      // Ensure Admin User document exists in database for relational integrity
      let adminUser = await User.findOne({ email: cleanInputEmail });
      if (!adminUser) {
        adminUser = await User.findOne({ role: "admin" });
      }
      if (!adminUser) {
        const passwordHash = await hashPassword(cleanInputPassword);
        adminUser = await User.create({
          name: "Bitmax Admin",
          email: cleanInputEmail,
          passwordHash,
          role: "admin",
          companyId: null,
        });
      } else {
        adminUser.lastLoginAt = new Date();
        await adminUser.save();
      }

      const accessToken = generateAccessToken({
        userId: adminUser._id.toString(),
        role: "admin",
        companyId: null,
      });
      const refreshToken = generateRefreshToken({ userId: adminUser._id.toString() });

      res.cookie("access_token", accessToken, accessCookieOptions);
      res.cookie("refresh_token", refreshToken, refreshCookieOptions);

      return res.json({
        token: accessToken,
        accessToken,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: "admin",
          companyId: null,
        },
      });
    }

    // 2. Secondary check: Match against stored User DB credentials (if user registered earlier or via DB)
    let user = await User.findOne({ email: cleanInputEmail });
    if (user) {
      const valid = await comparePassword(password, user.passwordHash);
      if (valid) {
        user.lastLoginAt = new Date();
        await user.save();

        const accessToken = generateAccessToken({
          userId: user._id.toString(),
          role: user.role,
          companyId: user.companyId?.toString() || null,
        });
        const refreshToken = generateRefreshToken({ userId: user._id.toString() });

        res.cookie("access_token", accessToken, accessCookieOptions);
        res.cookie("refresh_token", refreshToken, refreshCookieOptions);

        return res.json({
          token: accessToken,
          accessToken,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
          },
        });
      }
    }

    // 3. Candidate check (for test-takers)
    const candidateDoc = await Candidate.findOne({ email: cleanInputEmail });
    if (candidateDoc) {
      const accessToken = generateAccessToken({
        userId: candidateDoc._id.toString(),
        role: "candidate",
        companyId: candidateDoc.companyId?.toString() || null,
      });
      const refreshToken = generateRefreshToken({ userId: candidateDoc._id.toString() });

      res.cookie("access_token", accessToken, accessCookieOptions);
      res.cookie("refresh_token", refreshToken, refreshCookieOptions);

      return res.json({
        token: accessToken,
        accessToken,
        user: {
          id: candidateDoc._id,
          name: candidateDoc.name,
          email: candidateDoc.email,
          role: "candidate",
          companyId: candidateDoc.companyId,
        },
      });
    }

    // 4. Invalid credentials
    return res.status(401).json({ error: "Invalid email or password" });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  return res.status(403).json({ error: "Registration is disabled. Admin access is controlled via environment credentials." });
});

// GET /api/auth/me
router.get("/me", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    let user = await User.findById(req.user!.userId).select("-passwordHash");
    if (!user) {
      const candidate = await Candidate.findById(req.user!.userId);
      if (candidate) {
        return res.json({
          user: {
            id: candidate._id,
            name: candidate.name,
            email: candidate.email,
            role: "candidate",
            companyId: candidate.companyId,
          },
        });
      }
      return res.status(404).json({ error: "User not found" });
    }
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

  let user = await User.findById(payload.userId);
  let userRole = user?.role || "admin";

  if (!user) {
    const candidate = await Candidate.findById(payload.userId);
    if (!candidate) return res.status(401).json({ error: "User not found" });
    userRole = "candidate";
  }

  const accessToken = generateAccessToken({
    userId: payload.userId,
    role: userRole,
    companyId: null,
  });

  res.cookie("access_token", accessToken, accessCookieOptions);

  return res.json({ token: accessToken, accessToken, message: "Token refreshed" });
});

export default router;
