// Project 5 · Harpreet Singh · Adapted from Baby_Boxes.js
"use strict";

const canvas = document.getElementById("renderCanvas");
const statusLine = document.getElementById("status");
const motionButton = document.getElementById("motion");
const xrButton = document.getElementById("xr");
const viewButtons = [...document.querySelectorAll("[data-view]")];
const B = window.BABYLON;

function createScene(engine) {
    const scene = new B.Scene(engine);
    const v = (x, y, z) => new B.Vector3(x, y, z);
    const color = hex => B.Color3.FromHexString(hex);
    scene.clearColor = new B.Color4(0.054, 0.094, 0.132, 1);
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.022;
    scene.fogColor = color("#142634");

    const views = {
        overview: { target: v(0, 0.95, 0), radius: 17.5, alpha: -Math.PI * 0.58, beta: 1.02 },
        towers:   { target: v(-1.85, 2.45, 0.4), radius: 10.5, alpha: -1.95, beta: 1.11 },
        beacon:   { target: v(2.85, 1.65, 1.65), radius: 7.5, alpha: -1.48, beta: 1.13 },
        drone:    { target: v(2.25, 1.55, -2.65), radius: 6.8, alpha: -1.1, beta: 0.98 }
    };
    const defaultView = views.overview;
    const camera = new B.ArcRotateCamera("Camera", defaultView.alpha, defaultView.beta,
        defaultView.radius, defaultView.target.clone(), scene);
    camera.attachControl(canvas, false);
    camera.lowerRadiusLimit = 4;
    camera.upperRadiusLimit = 40;
    camera.lowerBetaLimit = 0.23;
    camera.upperBetaLimit = 1.52;
    camera.panningSensibility = 0;
    camera.wheelDeltaPercentage = 0.018;
    camera.pinchDeltaPercentage = 0.008;
    camera.minZ = 0.1;
    const frameRadius = view => view.radius * Math.max(1, 1.12 * engine.getRenderHeight() / engine.getRenderWidth());
    camera.radius = frameRadius(defaultView);

    const ambient = new B.HemisphericLight("Sky fill", v(0.2, 1, -0.3), scene);
    ambient.intensity = 0.95;
    ambient.diffuse = color("#bee8ff");
    ambient.groundColor = color("#534761");
    const key = new B.DirectionalLight("Warm key", v(0.6, -1, 0.38), scene);
    key.position = v(-8, 13, -5);
    key.diffuse = color("#fff0db");
    key.intensity = 1.65;
    const rim = new B.PointLight("Blue rim", v(5, 6, 4), scene);
    rim.diffuse = color("#4fa8ff");
    rim.intensity = 18;
    rim.range = 18;

    const shadows = new B.ShadowGenerator(1024, key);
    shadows.usePercentageCloserFiltering = true;
    shadows.bias = 0.003;
    shadows.normalBias = 0.05;
    const skyGlow = new B.GlowLayer("Instrument lights", scene, { mainTextureFixedSize: 512, blurKernelSize: 32 });
    skyGlow.intensity = 0.48;

    function mat(name, hex, emission) {
        const m = new B.PBRMaterial(name, scene);
        m.albedoColor = color(hex).toLinearSpace();
        m.metallic = 0.05;
        m.roughness = 0.66;
        if (emission) m.emissiveColor = color(hex).scale(emission);
        return m;
    }
    const palette = {
        base: mat("Blue slate", "#263a4a"), floor: mat("Dust", "#243744"),
        trim: mat("Dark trim", "#121e2d"), panel: mat("Ceramic", "#7893a0"),
        jade: mat("Jade", "#3ea89a"), coral: mat("Coral", "#ed8264"),
        sand: mat("Sand", "#eab25b"), blue: mat("Cobalt", "#536eab"),
        mint: mat("Mint light", "#69ffe1", 0.56), amber: mat("Amber light", "#ffd273", 0.48)
    };
    function place(shape, name, options, position, material, cast = false) {
        const mesh = B.MeshBuilder[shape](name, options, scene);
        mesh.position.copyFrom(position);
        mesh.material = material;
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        if (cast) shadows.addShadowCaster(mesh);
        return mesh;
    }
    const box = (name, w, h, d, x, y, z, m, cast = true) =>
        place("CreateBox", name, { width: w, height: h, depth: d }, v(x, y, z), m, cast);
    const cylinder = (name, dia, h, x, y, z, m, sides = 48, cast = true) =>
        place("CreateCylinder", name, { diameter: dia, height: h, tessellation: sides }, v(x, y, z), m, cast);
    function ring(name, diameter, thickness, x, y, z, material) {
        return place("CreateTorus", name, { diameter, thickness, tessellation: 72 }, v(x, y, z), material);
    }

    // Replace the starter's oversized ground with a finite floor and round station deck.
    const ground = place("CreateGround", "Ground", { width: 156, height: 156 }, v(0, -0.14, 0), palette.floor);
    ground.isPickable = true;
    cylinder("Deck foundation", 14, 0.4, 0, 0.1, 0, palette.trim, 80);
    cylinder("Deck top", 13.75, 0.17, 0, 0.295, 0, palette.base, 80);
    ring("Outer illuminated rail", 13.86, 0.035, 0, 0.275, 0, palette.mint);
    ring("Inset walkway", 11.85, 0.026, 0, 0.385, 0, palette.panel);
    const deckTop = 0.38;

    // Stack the repositioned boxes using accumulated half heights so faces meet.
    const blocks = [];
    function stack(label, x, z, layers) {
        let bottom = deckTop;
        layers.forEach(([w, h, d, dx, dz, material], i) => {
            const item = box(label + " " + (i + 1), w, h, d, x + dx, bottom + h / 2, z + dz, material);
            item.isPickable = true;
            blocks.push({ item, origin: item.position.clone(), rotation: item.rotation.clone() });
            bottom += h;
        });
    }
    stack("Main stack", -2.75, 0.85, [
        [2.7, 0.85, 2.38, 0, 0, palette.blue],
        [2.25, 0.95, 1.94, 0.1, -0.05, palette.coral],
        [1.69, 0.91, 1.58, -0.1, 0.025, palette.sand],
        [1.25, 0.8, 1.19, -0.03, 0, palette.jade],
        [0.88, 0.56, 0.88, -0.13, 0.03, palette.panel]
    ]);
    stack("Relay stack", -0.25, 2.65, [
        [1.68, 0.69, 1.52, 0, 0, palette.trim],
        [1.45, 0.70, 1.25, 0, 0, palette.jade],
        [1.09, 0.58, 1, 0.10, -0.05, palette.sand],
        [0.78, 0.48, 0.71, 0.14, 0.03, palette.coral]
    ]);

    // Cylinders, spheres and toruses frame the two imported instruments.
    const orb = place("CreateSphere", "Orrery sphere", { diameter: 0.64, segments: 24 },
        v(-2.88, 4.77, 0.89), palette.mint, true);
    const orbit = ring("Orrery ring", 1.19, 0.052, -2.88, 4.77, 0.89, palette.amber);
    orbit.rotation.z = 0.48;
    cylinder("Beacon plinth", 2.74, 0.30, 2.85, 0.53, 1.65, palette.blue, 12);
    ring("Beacon marker", 2.30, 0.037, 2.85, 0.692, 1.65, palette.amber);
    cylinder("Drone landing pad", 3.08, 0.24, 2.25, 0.50, -2.65, palette.trim, 12);
    ring("Landing ring", 2.46, 0.034, 2.25, 0.625, -2.65, palette.mint);
    box("Landing stripe", 1, 0.015, 0.15, 2.25, 0.627, -2.65, palette.panel, false);
    for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const x = 6.35 * Math.cos(a), z = 6.35 * Math.sin(a);
        cylinder("Perimeter marker " + i, 0.15, 0.10, x, 0.43, z, i % 4 ? palette.panel : palette.mint, 8, false);
    }
    for (let i = 0; i < 7; i++) {
        box("Path tile " + i, 0.66, 0.016, 0.22, 0.1, 0.39, -5.15 + i * 0.44, palette.panel, false);
    }

    let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let elapsed = 0;
    let drone;
    function syncMotion() {
        motionButton.textContent = paused ? "Resume motion" : "Pause motion";
        motionButton.setAttribute("aria-pressed", String(paused));
    }
    syncMotion();
    motionButton.addEventListener("click", () => { paused = !paused; syncMotion(); });
    scene.onBeforeRenderObservable.add(() => {
        if (paused) return;
        elapsed += Math.min(0.05, engine.getDeltaTime() / 1000);
        orb.position.y = 4.77 + 0.075 * Math.sin(elapsed * 1.7);
        orbit.rotation.y = elapsed * 0.52;
        if (drone) {
            drone.position.y = 1.3 + 0.14 * Math.sin(elapsed * 1.7);
            drone.rotation.y = -0.45 + 0.22 * Math.sin(elapsed * 0.73);
        }
    });

    for (const button of viewButtons) {
        button.addEventListener("click", () => {
            const view = views[button.dataset.view];
            camera.inertialAlphaOffset = 0;
            camera.inertialBetaOffset = 0;
            camera.inertialRadiusOffset = 0;
            camera.setTarget(view.target.clone());
            camera.alpha = view.alpha;
            camera.beta = view.beta;
            camera.radius = frameRadius(view);
            viewButtons.forEach(b => b.setAttribute("aria-pressed", String(b === button)));
        });
    }
    canvas.addEventListener("keydown", event => {
        if (!["+", "=", "-"].includes(event.key)) return;
        event.preventDefault();
        camera.radius = B.Scalar.Clamp(camera.radius + (event.key === "-" ? 0.8 : -0.8), 4, 40);
    });

    async function importObject(filename, position, yaw) {
        const { meshes } = await B.ImportMeshAsync("./" + filename, scene);
        const group = new B.TransformNode(filename, scene);
        group.position.copyFrom(position);
        group.rotation.y = yaw;
        for (const mesh of meshes) {
            if (!mesh.parent) mesh.parent = group;
            mesh.isPickable = false;
            mesh.receiveShadows = true;
            if (mesh.getTotalVertices()) shadows.addShadowCaster(mesh);
        }
        return group;
    }
    Promise.allSettled([
        importObject("signal-beacon.glb", v(2.85, 0.68, 1.65), 0.22),
        importObject("survey-drone.glb", v(2.25, 1.30, -2.65), -0.45).then(group => { drone = group; })
    ]).then(results => {
        const count = results.filter(result => result.status === "fulfilled").length;
        for (const result of results) if (result.status === "rejected") console.error(result.reason);
        statusLine.textContent = count === 2 ? "" : count + " of 2 models loaded. Serve the whole folder over HTTP.";
        statusLine.dataset.models = String(count);
    });

    // Keep the starter's headset path. On desktop it is optional.
    async function setupVR() {
        if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return;
        const xr = await scene.createDefaultXRExperienceAsync({ floorMeshes: [ground], disableDefaultUI: true });
        if (!xr.baseExperience) return;
        let held = null;
        let holder = null;
        function release(reset) {
            if (!held) return;
            held.item.setParent(null);
            if (reset) {
                held.item.position.copyFrom(held.origin);
                held.item.rotationQuaternion = null;
                held.item.rotation.copyFrom(held.rotation);
            }
            held = holder = null;
        }
        xr.input.onControllerAddedObservable.add(controller => {
            controller.onMotionControllerInitObservable.add(motionController => {
                const trigger = motionController.getMainComponent();
                trigger?.onButtonStateChangedObservable.add(() => {
                    if (!trigger.changes.pressed) return;
                    if (!trigger.pressed) { if (holder === controller) release(false); return; }
                    if (held) return;
                    const picked = xr.pointerSelection?.getMeshUnderPointer(controller.uniqueId);
                    held = blocks.find(block => block.item === picked) || null;
                    if (held) {
                        holder = controller;
                        held.item.setParent(controller.grip || controller.pointer);
                    }
                });
            });
        });
        xr.input.onControllerRemovedObservable.add(controller => { if (holder === controller) release(true); });
        xr.baseExperience.onStateChangedObservable.add(state => {
            if (state === B.WebXRState.NOT_IN_XR) {
                release(true);
                blocks.forEach(({ item, origin, rotation }) => {
                    item.position.copyFrom(origin);
                    item.rotationQuaternion = null;
                    item.rotation.copyFrom(rotation);
                });
                xrButton.textContent = "Enter VR";
            }
        });
        xrButton.hidden = false;
        xrButton.addEventListener("click", async () => {
            try {
                if (xr.baseExperience.state === B.WebXRState.IN_XR) await xr.baseExperience.exitXRAsync();
                else if (xr.baseExperience.state === B.WebXRState.NOT_IN_XR) {
                    await xr.baseExperience.enterXRAsync("immersive-vr", "local-floor", xr.renderTarget);
                    xrButton.textContent = "Exit VR";
                }
            } catch (error) {
                console.warn(error);
                statusLine.textContent = "Could not start VR. Desktop controls are still available.";
            }
        });
    }
    setupVR().catch(error => console.warn("Optional VR setup:", error));
    return scene;
}

try {
    if (!B || !B.Engine.isSupported()) throw new Error("WebGL is unavailable");
    const engine = new B.Engine(canvas, true, { adaptToDeviceRatio: true });
    const scene = createScene(engine);
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    new ResizeObserver(resize).observe(canvas);
    window.addEventListener("resize", resize);
} catch (error) {
    console.error(error);
    statusLine.textContent = "The 3D scene needs a browser with WebGL enabled.";
}
