/**
 * NACA 2412 – AoA, Flow Bending & Cl–α Plot (p5.js)
 * Matches Processing version behavior:
 *  - Positive AoA rotates CW; Negative AoA rotates CCW.
 *  - Background white; all strokes/text black.
 *  - Airfoil mirrored about horizontal axis to match reference (y-up frame).
 *  - Wind from left to right with bent flow near the airfoil.
 *  - Live Cl–α plot with simple stall model and current operating point.
 *  - Spacious layout to avoid overlaps.
 */

let W = 1100, H = 700;          // canvas size
let chord = 520;                 // chord length (px)
let aoaDeg = 0;                  // CW positive (p5 rotates CW for + angles in y-down)
const AOA_MIN = -20, AOA_MAX = 20;

let outline = [];                // array of p5.Vector forming closed polygon
let foilX, foilY;                // placement
let N_PARTICLES = 800;
let U = 3.0;                     // free-stream speed (px/frame)
let particles = [];

let plotW = 360, plotH = 280;
let plotX, plotY;

function setup() {
  createCanvas(W, H);
  // positions (kept as in original)
  foilX = W * 0.20;
  foilY = H * 0.55;
  plotX = W - 32 - plotW;
  plotY = 90;

  // Generate NACA 2412 outline, mirrored vertically for screen y-down
  outline = generateNACA2412OutlineMirrored(2412, chord, 200, true);

  // Init particles (left->right wind)
  for (let i = 0; i < N_PARTICLES; i++) {
    particles.push(new Particle(random(width), random(height)));
  }

  textSize(14);
  textAlign(LEFT, BASELINE);
  noSmooth();
}

function draw() {
  background(255);

  // ---- HUD (top-left)
  noStroke(); fill(0);
  text("NACA 2412 — AoA, Flow & Lift", 130, 36);
  text("Controls: LEFT/RIGHT to change α,   R to reset", 180, 58);
  text(`α = ${aoaDeg.toFixed(1)}° (CW positive)`, 105, 80);

  // ---- Free-stream arrow (bottom-left)
  stroke(0); strokeWeight(2); noFill();
  let ax = 60, ay = H - 80, aL = 120;
  line(ax, ay, ax + aL, ay);
  line(ax + aL, ay, ax + aL - 10, ay - 4);
  line(ax + aL, ay, ax + aL - 10, ay + 4);
  noStroke(); fill(0); text("U∞", ax + aL + 15, ay + 5);

  // ---- Plot background (mask so flow doesn't overlap)
  noStroke(); fill(255);
  rect(plotX, plotY, plotW, plotH);

  // ---- Flow particles
  for (let p of particles) { p.update(); p.render(); }

  // ---- Airfoil (lower-right region, same positions)
  push();
  translate(foilX, foilY);
  rotate(radians(aoaDeg)); // CW positive in p5 with y-down screen

  // chord line
  stroke(0); strokeWeight(1.5); noFill();
  line(-chord * 0.25, 0, chord * 0.75, 0);
  line(0, -10, 0, 10); // quarter-chord marker

  // outline
  stroke(0); strokeWeight(2); noFill();
  beginShape();
  for (let v of outline) vertex(v.x, v.y);
  endShape(CLOSE);
  pop();

  // ---- Cl–α plot (top-right)
  drawClPlot();

  // ---- Safe frame
  noFill(); stroke(0); rect(12, 12, width - 24, height - 24);
}

/* ==================== PARTICLES / FLOW ==================== */
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(U + random(0.4), random(-0.2, 0.2));
  }
  update() {
    // Base freestream
    let vx = U, vy = 0;

    // Induced “downwash” near the rotating airfoil (toy model)
    let a = radians(aoaDeg);
    let ca = cos(a), sa = sin(a);

    // world relative to pivot
    let wx = this.pos.x - foilX;
    let wy = this.pos.y - foilY;

    // rotate into foil frame
    let xLocal =  wx * ca + wy * sa;
    let yLocal = -wx * sa + wy * ca;

    // Influence strongest near chord line and x ∈ [0, chord]
    let scale = 80;    // vertical decay
    let k = 5.0;       // magnitude gain
    let influence = k * radians(aoaDeg) / (1.0 + abs(yLocal) / scale);

    // Window in x
    let window = constrain(map(abs(xLocal), 0, chord, 1, 0), 0, 1);
    let vfade  = exp(-sq(yLocal) / (2 * sq(1.4 * scale)));

    vy += influence * pow(window, 0.7) * vfade;

    // Update & wrap
    this.vel.set(vx, vy);
    this.pos.add(this.vel);

    if (this.pos.x > width + 10) {
      this.pos.x = -20;
      this.pos.y = random(height);
    }
    if (this.pos.y < -20 || this.pos.y > height + 20) {
      this.pos.x = random(-40, 0);
      this.pos.y = random(height);
    }
  }
  render() {
    stroke(0, 160); strokeWeight(2);
    point(this.pos.x, this.pos.y);
  }
}

/* ==================== LIFT MODEL & PLOT ==================== */
function clFromAlpha(alphaDeg) {
  // Thin-airfoil linear up to stall, then simple drop (symmetric)
  let a = radians(alphaDeg);
  let clLinear = 2 * PI * a;
  let aStall = radians(15);
  if (abs(a) <= aStall) return clLinear;

  let clAtStall = 2 * PI * aStall;
  let drop = (abs(a) - aStall) / radians(10);  // fully reduced by ~25°
  let cl = lerp(clAtStall, clAtStall * 0.35, constrain(drop, 0, 1));
  return (a >= 0 ? cl : -cl);
}

function drawClPlot() {
  push();
  translate(plotX, plotY);

  // Axes box
  stroke(0); noFill(); rect(0, 0, plotW, plotH);
  let px = 40, py = 28;
  let pw = plotW - 70, ph = plotH - 60;

  translate(px, py);

  // axes
  stroke(0); strokeWeight(1);
  line(0, ph / 2, pw, ph / 2);   // Cl = 0
  line(pw / 2, 0, pw / 2, ph);   // α = 0

  // grid
  for (let a = -20; a <= 20; a += 5) {
    let x = map(a, -20, 20, 0, pw);
    line(x, 0, x, ph);
  }
  for (let c = -2.5; c <= 2.5; c += 0.5) {
    let y = map(c, 2.8, -2.8, 0, ph);
    line(0, y, pw, y);
  }

  // Linear (no stall) dashed
  stroke(0); strokeWeight(2);
  for (let i = 1; i <= 220; i++) {
    if (i % 6 < 3) {
      let a0 = map(i - 1, 0, 220, -20, 20);
      let a1 = map(i,     0, 220, -20, 20);
      let cl0 = 2 * PI * radians(a0);
      let cl1 = 2 * PI * radians(a1);
      let x0 = map(a0, -20, 20, 0, pw);
      let y0 = map(cl0, 2.8, -2.8, 0, ph);
      let x1 = map(a1, -20, 20, 0, pw);
      let y1 = map(cl1, 2.8, -2.8, 0, ph);
      line(x0, y0, x1, y1);
    }
  }

  // Stall model solid
  noFill(); strokeWeight(3);
  beginShape();
  for (let i = 0; i <= 220; i++) {
    let a = map(i, 0, 220, -20, 20);
    let cl = clFromAlpha(a);
    let x = map(a, -20, 20, 0, pw);
    let y = map(cl, 2.8, -2.8, 0, ph);
    vertex(x, y);
  }
  endShape();

  // Current operating point
  let clNow = clFromAlpha(aoaDeg);
  let xNow = map(aoaDeg, -20, 20, 0, pw);
  let yNow = map(clNow, 2.8, -2.8, 0, ph);
  noStroke(); fill(0); ellipse(xNow, yNow, 10, 10);

  // Labels
  fill(0); noStroke();
  text("Cl vs Angle of Attack", 30, -8);

  push(); translate(pw / 2, ph + 22); textAlign(CENTER, BASELINE); text("α (deg)", 0, 0); pop();
  push(); translate(-20, ph / 2); rotate(-HALF_PI); textAlign(CENTER, BASELINE); text("Cl", 0, 0); pop();

  // Legend
  let lx = 6, ly = ph - 40;
  stroke(0); strokeWeight(3); line(lx + 145, ly, lx + 24 + 145, ly);
  noStroke(); fill(0); text("Stall model", lx + 100, ly + 5);
  stroke(0); strokeWeight(2);
  for (let i = 0; i < 3; i++) { line(lx + i * 10 + 145, ly + 18, lx + i * 10 + 6 + 145, ly + 18); }
  noStroke(); fill(0); text("Linear", lx + 100, ly + 23);

  // Readout
  text(`α = ${aoaDeg.toFixed(1)}°,  Cl = ${clNow >= 0 ? "+" : ""}${clNow.toFixed(2)}`, 25, ph + 50);

  pop();
}

/* ==================== INPUT ==================== */
function keyPressed() {
  if (keyCode === RIGHT_ARROW) {
    aoaDeg = constrain(aoaDeg + 0.5, AOA_MIN, AOA_MAX); // CW
  } else if (keyCode === LEFT_ARROW) {
    aoaDeg = constrain(aoaDeg - 0.5, AOA_MIN, AOA_MAX); // CCW
  } else if (key === 'r' || key === 'R') {
    aoaDeg = 0;
  }
}

/* ==================== AIRFOIL GENERATOR ====================
 * 4-digit NACA (e.g., 2412): m = 0.02, p = 0.4, t = 0.12
 * Returns outline with quarter-chord at x=0 (pivot), and MIRRORED in y
 * so it appears correctly in the y-down screen coordinates.
 */
function generateNACA2412OutlineMirrored(code, c, N, cosineSpacing) {
  let d1 = Math.floor(code / 1000) % 10;
  let d2 = Math.floor(code / 100) % 10;
  let d34 = code % 100;

  let m = d1 / 100.0;   // max camber
  let p = d2 / 10.0;    // location of max camber
  let t = d34 / 100.0;  // thickness ratio

  let x = new Array(N + 1);
  for (let i = 0; i <= N; i++) {
    let beta = PI * i / N;
    let xi = cosineSpacing ? (0.5 * (1 - cos(beta))) : (i / N);
    x[i] = xi * c;
  }

  let upper = [];
  let lower = [];

  for (let i = 0; i <= N; i++) {
    let xi = x[i], xc = xi / c;

    let yt = 5.0 * t * ( 0.2969 * sqrt(max(0, xc))
                       - 0.1260 * xc
                       - 0.3516 * xc * xc
                       + 0.2843 * xc * xc * xc
                       - 0.1015 * xc * xc * xc * xc ) * c;

    let yc, dyc_dx;
    if (p > 0 && xc < p) {
      yc     = (m / (p * p)) * (2 * p * xc - xc * xc) * c;
      dyc_dx = (2 * m / (p * p)) * (p - xc);
    } else if (p > 0) {
      yc     = (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * xc - xc * xc) * c;
      dyc_dx = (2 * m / ((1 - p) * (1 - p))) * (p - xc);
    } else { yc = 0; dyc_dx = 0; }

    let theta = atan(dyc_dx);

    let xu = xi - yt * sin(theta);
    let yu = yc + yt * cos(theta);
    let xl = xi + yt * sin(theta);
    let yl = yc - yt * cos(theta);

    // Quarter-chord shift so x=0 at quarter-chord (pivot)
    let shift = c * 0.25;

    // Mirror in y: analytic y-up -> screen y-down
    upper.push(createVector(xu - shift, -yu));
    lower.push(createVector(xl - shift, -yl));
  }

  // Build closed outline: LE -> TE (upper), then TE -> LE (lower)
  let out = [];
  out.push(...upper);
  for (let i = lower.length - 1; i >= 0; i--) out.push(lower[i]);
  return out;
}
