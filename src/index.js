/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as THREE from 'three';

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Text} from 'troika-three-text';
import { XR_BUTTONS } from 'gamepad-wrapper';
import {gsap} from 'gsap';
import { init } from './init.js';

const ballSpeed = 8;
const launchAngle = THREE.MathUtils.degToRad(60);
const launchVector = new THREE.Vector3(0, Math.sin(launchAngle) * ballSpeed, -Math.cos(launchAngle) * ballSpeed);
const gravity = new THREE.Vector3(0, -9.8, 0);

const ballTimeToLive = 1.75;

let ball = null;

let launcher, ring, arrow;
let defaultMaterial;
const highlightMaterial = new THREE.MeshStandardMaterial({ color: 'green' });

let score = 0;
const scoreText = new Text();
scoreText.fontSize = 0.52;
scoreText.font = 'assets/SpaceMono-Bold.ttf';
scoreText.position.z = -2;
scoreText.color = 0xffa276;
scoreText.anchorX = 'center';
scoreText.anchorY = 'middle';

let laserSound, scoreSound;

let isScoring = false;

function updateScoreDisplay() {
    const clampedScore = Math.max(0, Math.min(9999, score));
	const displayScore = clampedScore.toString().padStart(4, '0');
	scoreText.text = displayScore;
	scoreText.sync();
}

function moveRingUp() {
    gsap.to(ring.position, {
        duration: 2,
        y: 4,
        ease: 'sine.inOut',
        onComplete: () => {
            moveRingDown();
        }
    });
}

function moveRingDown() {
    gsap.to(ring.position, {
        duration: 2,
        y: 0,
        ease: 'sine.inOut',
        onComplete: () => {
            moveRingUp();
        }
    });
}

function setupScene({ scene, camera, renderer, player, controllers }) {
	const gltfLoader = new GLTFLoader();

    gltfLoader.load('assets/spacestation.glb', gltf => {
        scene.add(gltf.scene);
    });

    gltfLoader.load('assets/launcher.glb', gltf => {
        launcher = gltf.scene;
        launcher.position.set(0, 2, -1);
        scene.add(launcher);
    });

    gltfLoader.load('assets/ring.glb', gltf => {
        ring = gltf.scene;
        ring.position.set(0, 0, -6);
        ring.rotateY(Math.PI / 2);
        ring.rotateZ(-Math.PI / 6);
        ring.scale.set(0.75, 0.75, 0.75);
        scene.add(ring);
        moveRingUp();
    });

    gltfLoader.load('assets/arrow.glb', gltf => {
        arrow = gltf.scene;
        arrow.position.set(0, 2.5, -1);
        arrow.rotateX(-Math.PI / 6);
        arrow.scale.set(0.3, 0.3, 0.3);
        defaultMaterial = arrow.getObjectByName('Arrow').material;
        scene.add(arrow);
    });

    scene.add(scoreText);
    scoreText.position.set(0, 0.67, -1.44);
    scoreText.rotateX(-Math.PI / 3.3);
    updateScoreDisplay();

    const listener = new THREE.AudioListener();
    camera.add(listener);

    const audioLoader = new THREE.AudioLoader();

    laserSound = new THREE.PositionalAudio(listener);
    audioLoader.load('assets/laser.ogg', buffer => {
        laserSound.setBuffer(buffer);
        launcher.add(laserSound);
    });

    scoreSound = new THREE.PositionalAudio(listener);
    audioLoader.load('assets/score.ogg', buffer => {
        scoreSound.setBuffer(buffer);
        scoreText.add(scoreSound);
    });
}

function onFrame(delta, time, {scene, camera, renderer, player, controllers}) {
    const controllerConfigs = [controllers.right, controllers.left];
    let hittingLauncherLeft = false;
    let hittingLauncherRight = false;
    for (let i = 0; i < 2; i++) {
        const controller = controllerConfigs[i];
        if (controller) {
            const {gamepad, raySpace, mesh} = controller;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromXRController(raySpace);

            const intersections = raycaster.intersectObjects(scene.children, true).map(obj => obj.object).map(obj => obj.name);
            if (intersections.includes('Launcher')) {
                if (i == 1) {
                    hittingLauncherLeft = true;
                } else {
                    hittingLauncherRight = true;
                }

                if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER) && ball == null) {
                    const ballPrototype = launcher.getObjectByName('Ball');
                    if (ballPrototype) {
                        try {
                            const hapticActuator = gamepad.getHapticActuator(0).pulse(0.6, 100);
                        } catch {
                            // do nothing
                        }

                        if (laserSound.isPlaying) laserSound.stop();
                        laserSound.play();

                        ball = ballPrototype.clone(true);
                        ball.scale.set(0.2, 0.2, 0.2);
                        scene.add(ball);
                        ballPrototype.getWorldPosition(ball.position);
                        ballPrototype.getWorldQuaternion(ball.quaternion);
                        
                        ball.userData = {
                            velocity: launchVector.clone(),
                            timeToLive: ballTimeToLive,
                        };
                    }
                }
            } else {
                if (i == 1) {
                    hittingLauncherLeft = false;
                } else {
                    hittingLauncherRight = false;
                }
            }
        }
    };
    
    if (hittingLauncherLeft || hittingLauncherRight) {
        if (arrow) {
            arrow.getObjectByName('Arrow').material = highlightMaterial;
        }
    } else {
        if (arrow) {
            arrow.getObjectByName('Arrow').material = defaultMaterial;
        }
    }

    if (ball != null) {
        if (ball.userData.timeToLive < 0) {
            gsap.to(ball.scale, {
                duration: 0.2,
                x: 0,
                y: 0,
                z: 0,
                onComplete: () => {
                    scene.remove(ball);
                    ball = null;
                }
            });
        } else {
            ball.userData.velocity.add(gravity.clone().multiplyScalar(delta));
            const deltaVec = ball.userData.velocity.clone().multiplyScalar(delta);
            ball.position.add(deltaVec);
            ball.userData.timeToLive -= delta;

            const distance = ring.position.distanceTo(ball.position);

            if (distance <= 0.65 && !isScoring) {
                isScoring = true;

                score += 10;
                updateScoreDisplay();

                if (scoreSound.isPlaying) scoreSound.stop();
                scoreSound.play();
                
                setTimeout(() => {
                    gsap.to(ball.scale, {
                        duration: 0.2,
                        x: 0,
                        y: 0,
                        z: 0,
                        onComplete: () => {
                            scene.remove(ball);
                            ball = null;
                            isScoring = false;
                        }
                    });
                }, 200);
            }
        }
    }

    gsap.ticker.tick(delta);
}

init(setupScene, onFrame);