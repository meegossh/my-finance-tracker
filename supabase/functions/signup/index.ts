import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase admin client
const supabase = createClient(
  "https://ykxaimwvkitcrgclikej.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreGFpbXd2a2l0Y3JnY2xpa2VqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTU2MTgxNCwiZXhwIjoyMDY3MTM3ODE0fQ.SiB9SLcYXfPYkySwykmJ42DpM01NmQIbSU6B5z7AOdY"
);

app.post("/create-user", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const { data, error } = await supabase.auth.admin.createUser({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ user: data.user });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
