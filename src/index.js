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

function setupScene({ scene, camera, renderer, player, controllers }) {
	
}

function onFrame(delta, time, {scene, camera, renderer, player, controllers}) {
	
}

init(setupScene, onFrame);