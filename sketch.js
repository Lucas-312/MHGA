
let stars = [];
let camPos;
let yaw = 0, pitch = 0; // Left and right rotation angle,up and down rotation angle
let moveSpeed = 10; // spaceship movespeed
let lookSpeed = 0.03; // rotation sensitivity
let verticalSpeed = 8; // to rise your spaceship
let loseSound;
let winSound;

let targets = [];  //store the "energy" (red ball)
let score = 0;
let gameState = "PLAY"; // PLAY, GAMEOVER, WIN

// Variable of Arduino, test the data in arduino beforehand
let serialPort;
let joyX = 514, joyY = 518, joySW1 = 1;
let lookX = 514, lookY = 518, joySW2 = 1;
let centerX = 514, centerY = 518;
let buffer = "";
let connectBtn;
function preload() {
  // Load the sound effect file
  loseSound = loadSound('lose.mp3');
  winSound = loadSound('win.mp3');
}

function setup() {


  connectBtn = createButton('Click to connect Arduino (COM3)');
  connectBtn.position(20, 20);
  connectBtn.mousePressed(connectToSerial);

  initGame();
  var myCanvas = createCanvas(windowWidth, windowHeight, WEBGL);
  myCanvas.parent("mySketch");
}
// initialize camera
function initGame() {
  camPos = createVector(0, 0, 800);
  score = 0;
  targets = [];
  gameState = "PLAY";

  document.getElementById('game-over-overlay').style.display = 'none';
  document.getElementById('win-overlay').style.display = 'none';
  updateInventoryUI();

  // generate 1000 stars
  stars = [];
  for (let i = 0; i < 1000; i++) {
    stars.push({
      //generate a vector which has random direction.then multiply 1000-5000,for 1000times. then player will be cover by a "universe" 
      pos: p5.Vector.random3D().mult(random(1000, 5000)),
      size: random(2, 5),
      phase: random(1000)
    });
  }
  for (let i = 0; i < 5; i++) spawnTarget();
}
// IMPORTANT PART: #1 to build a bridge between Webpage and Arduino:Web Serial API and Arduino Serial
async function connectToSerial() { // This function is for applying for access permission
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 }); // if you open the serialMonitor in Arduino, you will understand why
    connectBtn.hide();
    readSerial();
  } catch (err) { console.error("Serial port failure", err); }
}
// #2 Read the data that you made through using joystick
async function readSerial() {
  const reader = serialPort.readable.getReader(); //reading...
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
    let lines = buffer.split('\n');
    if (lines.length > 1) {
      let lastLine = lines[lines.length - 2].trim();
      let parts = lastLine.split(',');//because joystick always upload one set of data which include three numbers.every number represent different info,we have to use "," to divide them 
      if (parts.length >= 6) {
        joyX = int(parts[0]); joyY = int(parts[1]); joySW1 = int(parts[2]);
        lookX = int(parts[3]); lookY = int(parts[4]); joySW2 = int(parts[5]);
      }
      buffer = lines[lines.length - 1];
    }
  }
}

function draw() {
  background(5, 5, 15);
  if (gameState !== "PLAY") return; // if lose or win,stop the next part.

  // direction key(control the view angle)
 let lookOffX = lookX - centerX;
 let lookOffY = lookY - centerY;

  // left and right
  if (abs(lookOffX) > 60) {
    yaw -= (lookOffX / 512) * lookSpeed * 0.8; 
  }
  // up and down
  if (abs(lookOffY) > 60) {
    pitch += (lookOffY / 514) * lookSpeed * 0.8; 
  }
  pitch = constrain(pitch, -HALF_PI + 0.1, HALF_PI - 0.1);

  //calculate direction vector
  // forward
  let vX = cos(pitch) * sin(yaw);
  let vY = sin(pitch);
  let vZ = cos(pitch) * cos(yaw);
  let forward = createVector(vX, vY, vZ);
  // right, cauculate the moving of left and right
  let right = createVector(0, 1, 0).cross(forward).normalize();

  // use the joystick to control moving
  let offX = joyX - centerX;
  let offY = joyY - centerY;
  if (abs(offX) < 60) offX = 0;
  if (abs(offY) < 60) offY = 0;

  if (offY > 200) camPos.add(p5.Vector.mult(forward, moveSpeed)); // push the joystick up->move forward
  else if (offY < -200) camPos.sub(p5.Vector.mult(forward, moveSpeed)); // push down->move backward

  if (offX > 200) camPos.add(p5.Vector.mult(right, moveSpeed)); // push left->move left
  else if (offX < -200) camPos.sub(p5.Vector.mult(right, moveSpeed)); // push right->move right

  if (joySW1 === 0) {
    camPos.y -= verticalSpeed; // rise your spaceship when you press the joystick, reduce y
  }
  if (joySW2 === 0) {
    camPos.y += verticalSpeed; // decline your spaceship when you press the joystick, reduce y
  }

  if ((joySW1 === 0 || joySW2 === 0) && gameState !== "PLAY") initGame();
  // set up camera
  // show what you are seeing
  camera(camPos.x, camPos.y, camPos.z, camPos.x + vX, camPos.y + vY, camPos.z + vZ, 0, 1, 0);
  renderScene();
}
// stars rendering
function renderScene() {
  noStroke();
  let vX = cos(pitch) * sin(yaw);
  let vY = sin(pitch);
  let vZ = cos(pitch) * cos(yaw);
  let forward = createVector(vX, vY, vZ);

  for (let s of stars) {
   
    if (p5.Vector.dist(camPos, s.pos) > 6000) {
      s.pos = p5.Vector.add(camPos, p5.Vector.mult(forward, 4000));
      s.pos.add(p5.Vector.random3D().mult(random(1000, 2000)));
    }
    push();
    translate(s.pos.x, s.pos.y, s.pos.z);
    // let the stars shining,bright
    let b = map(sin(frameCount * 0.05 + s.phase), -1, 1, 80, 255);
    emissiveMaterial(255, 255, 255, b);
    sphere(s.size);
    pop();
  }

  for (let i = targets.length - 1; i >= 0; i--) {
    let t = targets[i];
    let d = p5.Vector.dist(camPos, t.pos);
    // to decide where are the traps
    if (d < 600 && t.hasTrap && !t.isRevealed) {
      t.isRevealed = true;//if the distance less than 600 between player(spaceship) and every signle energy
      let dirToPlayer = p5.Vector.sub(camPos, t.pos).normalize();//to calculate the player's direction
      t.trapPos = p5.Vector.add(t.pos, p5.Vector.mult(dirToPlayer, 300));//barrier(space junk) appears
    }

    push();
    translate(t.pos.x, t.pos.y, t.pos.z);
    fill(255, 20, 20);
    emissiveMaterial(255, 20, 20);
    sphere(35);
    pop();
    // render the barrier
    if (t.isRevealed && t.trapPos) {
      push();
      translate(t.trapPos.x, t.trapPos.y, t.trapPos.z);
      rotateY(yaw);
      fill(0, 255, 255, 150);
      box(450, 450, 15);
      pop();
      if (p5.Vector.dist(camPos, t.trapPos) < 200) gameOver();
    }
    // I found the moving of the spaceship always lost control when I am not using the joystick.so this syntax is to prevent jittering
    if (d < 60) {
      targets.splice(i, 1);
      score++;
      updateInventoryUI();
      if (score >= 10) winGame();
      else spawnTarget();
    }
  }
}

function updateInventoryUI() {
  let slots = document.querySelectorAll('.slot');
  slots.forEach((slot, i) => {
    if (i < score) slot.classList.add('active');
    else slot.classList.remove('active');
  });
}

function gameOver() {
  if (gameState === "PLAY") {
    loseSound.play();
  }
  gameState = "GAMEOVER";
  document.getElementById('game-over-overlay').style.display = 'flex';
}

function winGame() {
  if (gameState === "PLAY") {
    winSound.play();
  }
  gameState = "WIN";
  document.getElementById('win-overlay').style.display = 'flex';
}
// to decide whether have a trap or not.
function spawnTarget() {
  targets.push({
    pos: p5.Vector.random3D().mult(random(1500, 4000)), // random cordinate 
    hasTrap: random(1) < 0.4, trapPos: null, isRevealed: false // 40% chance. There will be a trap suddenly appear
  });
}

//click ENTER to restart
function keyPressed() {
  if (keyCode === ENTER && gameState !== "PLAY") initGame();
}


