const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const { spawn } = require("child_process");
const app = express();
const port = 3003;

try {
  require("dotenv").config();
} catch (e) {
  console.log("dotenv not installed, skipping .env file loading");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Aastha1811",
  database: process.env.DB_NAME || "petrol_pump_finder",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

async function verifyDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connection successful!");
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS petrol_pumps (
        id INT NOT NULL AUTO_INCREMENT,
        pump_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        distance DECIMAL(10,2) DEFAULT NULL,
        address TEXT,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pump_id (pump_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pump_id VARCHAR(255) NOT NULL,
        reviewer_name VARCHAR(255) NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review_text TEXT NOT NULL,
        review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pump_id) REFERENCES petrol_pumps(pump_id) ON DELETE CASCADE
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Pre-populate with sample data if table is empty
    const [rows] = await connection.query("SELECT COUNT(*) as count FROM petrol_pumps");
    if (rows[0].count === 0) {
      console.log("Petrol_pumps table is empty, pre-populating with sample data...");
      await connection.query(
        "INSERT INTO petrol_pumps (pump_id, name, latitude, longitude, distance, address) VALUES (?, ?, ?, ?, ?, ?)",
        ["12596227207", "IndianOil", 24.5426022, 81.2926181, 3.08, "Old Bus Stand Road, Rewa"]
      );
      await connection.query(
        "INSERT INTO petrol_pumps (pump_id, name, latitude, longitude, distance, address) VALUES (?, ?, ?, ?, ?, ?)",
        ["12596320995", "Indian Oil", 24.5430373, 81.2713486, 4.43, ""]
      );
      console.log("Sample data inserted successfully.");
    }

    connection.release();
    console.log("Database tables verified/created successfully!");
  } catch (error) {
    console.error("Database connection failed:", error.stack);
    console.log("Continuing without database connection...");
  }
}

verifyDatabaseConnection();

app.get("/", (req, res) => {
  try {
    res.render("signup", { 
      error: null, 
      username: "", 
      email: "", 
      showLogin: false,
      signupMessage: null,
      signupSuccess: false,
      loginMessage: null,
      loginSuccess: false
    });
  } catch (error) {
    console.error("Error rendering signup page:", error.stack);
    res.status(500).send("Error loading signup page");
  }
});

app.get("/signup", (req, res) => {
  try {
    res.render("signup", { 
      error: null, 
      username: "", 
      email: "", 
      showLogin: false,
      signupMessage: null,
      signupSuccess: false,
      loginMessage: null,
      loginSuccess: false
    });
  } catch (error) {
    console.error("Error rendering signup page:", error.stack);
    res.status(500).send("Error loading signup page");
  }
});

app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log("Signup attempt:", { username, email });
    
    if (!username || !email || !password) {
      return res.status(400).render("signup", { 
        error: "All fields are required",
        username: username || "",
        email: email || "",
        showLogin: false,
        signupMessage: "All fields are required",
        signupSuccess: false,
        loginMessage: null,
        loginSuccess: false
      });
    }
    
    if (!email.endsWith('@gmail.com')) {
      return res.status(400).render("signup", { 
        error: "Email must be a Gmail address (@gmail.com)",
        username,
        email,
        showLogin: false,
        signupMessage: "Email must be a Gmail address (@gmail.com)",
        signupSuccess: false,
        loginMessage: null,
        loginSuccess: false
      });
    }
    
    if (password.length < 8) {
      return res.status(400).render("signup", { 
        error: "Password must be at least 8 characters",
        username,
        email,
        showLogin: false,
        signupMessage: "Password must be at least 8 characters",
        signupSuccess: false,
        loginMessage: null,
        loginSuccess: false
      });
    }
    
    await pool.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, password]
    );
    
    res.render("signup", { 
      error: null, 
      username: "", 
      email: "", 
      showLogin: true,
      signupMessage: "Account created successfully! Please log in.",
      signupSuccess: true,
      loginMessage: null,
      loginSuccess: false
    });
  } catch (error) {
    console.error("Signup error:", error.stack);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).render("signup", { 
        error: "Username or email already exists",
        username: req.body.username || "",
        email: req.body.email || "",
        showLogin: false,
        signupMessage: "Username or email already exists",
        signupSuccess: false,
        loginMessage: null,
        loginSuccess: false
      });
    }
    
    res.status(500).render("signup", { 
      error: "An error occurred during signup",
      username: req.body.username || "",
      email: req.body.email || "",
      showLogin: false,
      signupMessage: "An error occurred during signup",
      signupSuccess: false,
      loginMessage: null,
      loginSuccess: false
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", { email });
    
    if (!email || !password) {
      return res.status(400).render("signup", { 
        error: "All fields are required",
        username: "",
        email: email || "",
        showLogin: true,
        loginMessage: "All fields are required",
        loginSuccess: false,
        signupMessage: null,
        signupSuccess: false
      });
    }
    
    if (!email.endsWith('@gmail.com')) {
      return res.status(400).render("signup", { 
        error: "Email must be a Gmail address (@gmail.com)",
        username: "",
        email,
        showLogin: true,
        loginMessage: "Email must be a Gmail address (@gmail.com)",
        loginSuccess: false,
        signupMessage: null,
        signupSuccess: false
      });
    }
    
    if (password.length < 8) {
      return res.status(400).render("signup", { 
        error: "Password must be at least 8 characters",
        username: "",
        email,
        showLogin: true,
        loginMessage: "Password must be at least 8 characters",
        loginSuccess: false,
        signupMessage: null,
        signupSuccess: false
      });
    }
    
    const [users] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND password = ?",
      [email, password]
    );
    
    if (users.length === 0) {
      return res.status(400).render("signup", { 
        error: "Invalid email or password",
        username: "",
        email,
        showLogin: true,
        loginMessage: "Invalid email or password",
        loginSuccess: false,
        signupMessage: null,
        signupSuccess: false
      });
    }
    
    res.redirect(`/home?user=${encodeURIComponent(users[0].username)}`);
  } catch (error) {
    console.error("Login error:", error.stack);
    res.status(500).render("signup", { 
      error: "An error occurred during login",
      username: "",
      email: req.body.email || "",
      showLogin: true,
      loginMessage: "An error occurred during login",
      loginSuccess: false,
      signupMessage: null,
      signupSuccess: false
    });
  }
});

app.get("/home", (req, res) => {
  try {
    const user_name = req.query.user || null;
    console.log(`Rendering home page for user: ${user_name}...`);
    
    if (!user_name) {
      return res.redirect("/");
    }
    
    res.render("home", {
      user_name: user_name,
      potential_fraud: "12",
      money_saved: "1,245",
      fuel_accuracy: "92"
    });
  } catch (error) {
    console.error("Error rendering home page:", error.stack);
    res.status(500).send("Error loading home page");
  }
});

app.get("/map", (req, res) => {
  try {
    const user_name = req.query.user || null;
    console.log(`Rendering map page for user: ${user_name}...`);
    
    if (!user_name) {
      return res.redirect("/");
    }
    
    res.render("map", {
      user_name: user_name
    });
  } catch (error) {
    console.error("Error rendering map page:", error.stack);
    res.status(500).send("Error loading map page");
  }
});

app.get("/logout", (req, res) => {
  console.log("User logging out...");
  res.redirect("/");
});

app.post("/api/petrol-pumps", async (req, res) => {
  try {
    const { id, name, lat, lon, distance, address } = req.body;

    if (!name || lat == null || lon == null) {
      console.error("Invalid input:", { id, name, lat, lon, distance, address });
      return res.status(400).json({ 
        success: false, 
        error: "Missing or invalid required fields: name, lat, lon" 
      });
    }

    const pump_id = id || `pump_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    console.log("Inserting into petrol_pumps:", { pump_id, name, lat: parseFloat(lat), lon: parseFloat(lon), distance: distance ? parseFloat(distance) : null, address });

    const [result] = await pool.query(
      "INSERT INTO petrol_pumps (pump_id, name, latitude, longitude, distance, address) VALUES (?, ?, ?, ?, ?, ?)",
      [pump_id, name, parseFloat(lat), parseFloat(lon), distance ? parseFloat(distance) : null, address || null]
    );

    console.log("Insert successful:", { affectedRows: result.affectedRows, insertId: result.insertId });

    res.json({ success: true, pump_id });
  } catch (error) {
    console.error("Error saving petrol pump:", error.stack);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: "Duplicate entry for pump (check unique constraints)" });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const { pump_id, reviewer_name, rating, review_text } = req.body;

    if (!pump_id || !reviewer_name || !rating || !review_text) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields" 
      });
    }

    console.log("Saving review:", { pump_id, reviewer_name, rating, review_text });

    await pool.query(
      "INSERT INTO reviews (pump_id, reviewer_name, rating, review_text) VALUES (?, ?, ?, ?)",
      [pump_id, reviewer_name, rating, review_text]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving review:", error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/reviews/:pumpId", async (req, res) => {
  try {
    const pumpId = req.params.pumpId;

    console.log("Getting reviews for pump:", pumpId);

    const [reviews] = await pool.query(
      "SELECT * FROM reviews WHERE pump_id = ? ORDER BY review_date DESC",
      [pumpId]
    );

    res.json({ success: true, reviews });
  } catch (error) {
    console.error("Error getting reviews:", error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function runMLAnalysis(pumpId) {
  return new Promise((resolve, reject) => {
    const pythonScriptPath = path.join(__dirname, "app.py");
    console.log(`Attempting to run Python script at: ${pythonScriptPath} with pump_id: ${pumpId}`);

    const pythonCommand = process.platform === "win32" ? "C:\\Users\\ASUS\\OneDrive\\Documents\\finalwala1.1.1\\finalwala1\\giveup2\\venv\\Scripts\\python.exe" : "python3";
    const pythonProcess = spawn(pythonCommand, [pythonScriptPath, pumpId]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log(`Python stdout: ${data.toString()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.log(`Python stderr: ${data.toString()}`);
    });

    pythonProcess.on("error", (err) => {
      console.error(`Failed to spawn Python process: ${err.message}`);
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });

    pythonProcess.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code !== 0) {
        console.error("Python script error:", errorOutput);
        reject(new Error("ML analysis failed: " + errorOutput));
      } else {
        try {
          const result = JSON.parse(output.trim());
          console.log(`Parsed ML output: ${JSON.stringify(result)}`);
          resolve(result);
        } catch (parseError) {
          console.error("Error parsing ML output:", parseError.stack);
          console.error("Raw output:", output);
          reject(new Error("Failed to parse ML output: " + parseError.message));
        }
      }
    });
  });
}

app.get("/petrol-pump-details", async (req, res) => {
  try {
    console.log("Entering /petrol-pump-details route...");

    const { id, name, lat, lon, distance } = req.query;

    if (!id) {
      console.error("No pump_id provided in query parameters.");
      return res.status(400).render("error", {
        message: "No pump ID provided.",
      });
    }

    const [pumps] = await pool.query(
      "SELECT * FROM petrol_pumps WHERE pump_id = ? ORDER BY created_at DESC LIMIT 1",
      [id]
    );

    if (pumps.length === 0) {
      console.warn(`No pumps found for pump_id: ${id}. Redirecting to map to add data.`);
      return res.redirect("/map?message=No pump data found, please add a pump.");
    }

    const pumpDetails = pumps[0];
    const pumpId = pumpDetails.pump_id;
    console.log("Pump details:", pumpDetails);

    const [reviews] = await pool.query(
      "SELECT * FROM reviews WHERE pump_id = ? ORDER BY review_date DESC",
      [pumpId]
    );
    console.log(`Fetched ${reviews.length} reviews for pump_id ${pumpId}`);

    let sentiment = { positive: 0, neutral: 0, negative: 0 };
    let topics = [];
    let verdict = "No verdict available.";

    try {
      console.log("Running ML analysis for pump_id:", pumpId);
      const mlResult = await runMLAnalysis(pumpId);
      console.log("ML analysis completed successfully:", mlResult);
      sentiment = mlResult.sentiment || sentiment;
      topics = Array.isArray(mlResult.topics) ? mlResult.topics : [];
      verdict = mlResult.verdict || verdict;
    } catch (mlError) {
      console.error("ML analysis error:", mlError.stack);
      sentiment = { positive: 0, neutral: 0, negative: 0 };
      topics = [];
      verdict = "ML analysis failed. Please check Python environment.";
    }

    console.log("Rendering petrol-pump-details.ejs...");
    res.render("petrol-pump-details", {
      pumpId: pumpId,
      pumpName: pumpDetails.name,
      pumpLat: pumpDetails.latitude,
      pumpLon: pumpDetails.longitude,
      pumpDistance: pumpDetails.distance || 0,
      pumpAddress: pumpDetails.address || "",
      reviews: reviews,
      sentiment: sentiment,
      topics: topics,
      verdict: verdict
    });
    console.log("Successfully rendered petrol-pump-details.ejs");
    
  } catch (error) {
    console.error("Error in petrol-pump-details route:", error.stack);
    res.status(500).render("error", {
      message: "An error occurred. Please try again.",
    });
  }
});

app.use((err, req, res, next) => {
  console.error("Application error:", err.stack);
  res.status(500).send("An unexpected error occurred. Please try again later.");
});

app.use((req, res) => {
  console.log("404 - Page not found:", req.url);
  res.status(404).send("Page not found");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Views directory: ${path.join(__dirname, "views")}`);
  console.log(`Static files directory: ${path.join(__dirname, "public")}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please free the port or change the port number in app.js.`);
    process.exit(1);
  } else {
    console.error("Server startup error:", err.stack);
    process.exit(1);
  }
});