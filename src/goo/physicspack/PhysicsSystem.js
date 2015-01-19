define([
	'goo/physicspack/AbstractPhysicsSystem',
	'goo/physicspack/RaycastResult',
	'goo/math/Vector3',
	'goo/math/Quaternion'
],
/** @lends */
function (
	AbstractPhysicsSystem,
	RaycastResult,
	Vector3,
	Quaternion
) {
	'use strict';

	/* global CANNON */

	var tmpVec1;
	var tmpVec2;
	var tmpQuat = new Quaternion();
	var tmpCannonResult;

	/**
	 * @class
	 * @extends AbstractPhysicsSystem
	 * @param {object} [settings]
	 * @param {Vector3} [settings.gravity]
	 * @param {number} [settings.stepFrequency=60]
	 * @param {number} [settings.maxSubSteps=10]
	 */
	function PhysicsSystem(settings) {
		settings = settings || {};

		/**
		 * @type {CANNON.World}
		 */
		this.cannonWorld = new CANNON.World({
			broadphase: new CANNON.SAPBroadphase()
		});

		var that = this;
		this.cannonWorld.addEventListener('postStep', function () {
			that.emitContactEvents();
		});

		this._entities = {};

		if (!tmpVec1) {
			tmpVec1 = new CANNON.Vec3();
			tmpVec2 = new CANNON.Vec3();
			tmpCannonResult = new CANNON.RaycastResult();
		}

		this.setGravity(settings.gravity || new Vector3(0, -10, 0));

		/**
		 * @type {number}
		 * @default 60
		 */
		this.stepFrequency = settings.stepFrequency || 60;

		/**
		 * The maximum number of timesteps to use for making the physics clock catch up with the wall clock. If set to zero, a variable timestep will be used (not recommended).
		 * @type {number}
		 * @default 10
		 */
		this.maxSubSteps = settings.maxSubSteps || 10;

		this._inContactCurrentStepA = [];
		this._inContactCurrentStepB = [];
		this._inContactLastStepA = [];
		this._inContactLastStepB = [];

		AbstractPhysicsSystem.call(this, 'PhysicsSystem', ['RigidbodyComponent']);
	}
	PhysicsSystem.prototype = Object.create(AbstractPhysicsSystem.prototype);
	PhysicsSystem.constructor = PhysicsSystem;

	/**
	 * @private
	 */
	PhysicsSystem.prototype._swapContactLists = function () {
		var tmp = this._inContactCurrentStepA;
		this._inContactCurrentStepA = this._inContactLastStepA;
		this._inContactLastStepA = tmp;
		this._inContactCurrentStepA.length = 0;

		tmp = this._inContactCurrentStepB;
		this._inContactCurrentStepB = this._inContactLastStepB;
		this._inContactLastStepB = tmp;
		this._inContactCurrentStepB.length = 0;
	};

	/**
	 * @param {Vector3} gravityVector
	 */
	PhysicsSystem.prototype.setGravity = function (gravityVector) {
		this.cannonWorld.gravity.copy(gravityVector);
	};

	/**
	 * @private
	 * @param {number} deltaTime
	 */
	PhysicsSystem.prototype.step = function (deltaTime) {
		var world = this.cannonWorld;

		// Step the world forward in time
		var fixedTimeStep = 1 / this.stepFrequency;
		var maxSubSteps = this.maxSubSteps;
		if (maxSubSteps) {
			// Fixed time step
			world.step(fixedTimeStep, deltaTime, maxSubSteps);
		} else {
			// Variable time step
			world.step(deltaTime);
		}
	};

	/**
	 * @private
	 */
	PhysicsSystem.prototype.emitContactEvents = function () {
		// Get overlapping entities
		var contacts = this.cannonWorld.contacts,
			num = contacts.length,
			entities = this._entities;

		this._swapContactLists();

		for (var i = 0; i !== num; i++) {
			var contact = contacts[i];

			var bodyA = contact.bi;
			var bodyB = contact.bj;
			var entityA = entities[bodyA.id];
			var entityB = entities[bodyB.id];

			if (bodyA.id > bodyB.id) {
				var tmp = entityA;
				entityA = entityB;
				entityB = tmp;
			}

			if (this._inContactLastStepA.indexOf(entityA) === -1) {
				this.emitBeginContact(entityA, entityB);
			} else {
				this.emitDuringContact(entityA, entityB);
			}

			this._inContactCurrentStepA.push(entityA);
			this._inContactCurrentStepB.push(entityB);
		}

		// Emit end contact events
		for (var i = 0; i !== this._inContactLastStepA.length; i++) {
			var entityA = this._inContactLastStepA[i];
			var entityB = this._inContactLastStepB[i];

			var found = false;
			for (var j = 0; j !== this._inContactCurrentStepA.length; j++) {
				if (entityA === this._inContactCurrentStepA[i] && entityB === this._inContactCurrentStepB[i]) {
					found = true;
					break;
				}
			}
			if (!found) {
				this.emitEndContact(entityA, entityB);
			}
		}
	};

	/**
	 * Make a ray cast into the world of colliders.
	 * @param  {Vector3} start
	 * @param  {Vector3} end
	 * @param  {RaycastResult} [result]
	 * @return {boolean} True if hit, else false
	 */
	PhysicsSystem.prototype.raycastClosest = function (start, end, result) {
		result = result || new RaycastResult();
		var cannonStart = tmpVec1;
		var cannonEnd = tmpVec2;
		cannonStart.copy(start);
		cannonEnd.copy(end);

		this.cannonWorld.rayTest(cannonStart, cannonEnd, tmpCannonResult);

		if (tmpCannonResult.hasHit) {
			result.entity = this._entities[tmpCannonResult.body.id];
			var p = tmpCannonResult.hitPointWorld;
			var n = tmpCannonResult.hitNormalWorld;
			result.point.setDirect(p.x, p.y, p.z);
			result.normal.setDirect(n.x, n.y, n.z);
		}

		return tmpCannonResult.hasHit;
	};

	/**
	 * Stops updating the entities
	 */
	PhysicsSystem.prototype.pause = function () {
		this.passive = true;
	};

	/**
	 * Resumes updating the entities
	 */
	PhysicsSystem.prototype.play = function () {
		this.passive = false;
	};

	PhysicsSystem.prototype.inserted = function (entity) {
		var rb = entity.rigidbodyComponent;
		if (rb._dirty) {
			rb.initialize();
		}
	};

	// PhysicsSystem.prototype.deleted = function (entity) {};

	/**
	 * @private
	 * @param  {array} entities
	 * @param  {number} tpf
	 */
	PhysicsSystem.prototype.process = function (entities, tpf) {
		var N = entities.length;

		// Initialize bodies
		for (var i = 0; i !== N; i++) {
			var entity = entities[i];
			var rb = entity.rigidbodyComponent;

			if (rb._dirty) {
				rb.initialize();
			}
		}

		// Initialize joints - must be done *after* all bodies were initialized
		for (var i = 0; i !== N; i++) {
			var entity = entities[i];

			var joints = entity.rigidbodyComponent.joints;
			for (var j = 0; j < joints.length; j++) {
				var joint = joints[j];
				if (!joint._dirty) {
					continue;
				}
				entity.rigidbodyComponent.initializeJoint(joint, entity, this);
				joint._dirty = false;
			}
		}

		this.step(tpf);

		// Update positions of entities from the physics data
		for (var i = 0; i !== N; i++) {
			var entity = entities[i];
			var rb = entity.rigidbodyComponent;
			var tc = entity.transformComponent;
			rb.getPosition(tc.transform.translation);
			rb.getQuaternion(tmpQuat);
			tc.transform.rotation.copyQuaternion(tmpQuat);
			tc.transform.update();
			tc.setUpdated();
		}
	};

	return PhysicsSystem;
});