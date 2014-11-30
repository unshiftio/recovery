'use strict';

var millisecond = require('millisecond')
  , Tick = require('tick-tock')
  , one = require('one-time');

/**
 * Attempt to recover your connection with reconnection attempt.
 *
 * @constructor
 * @param {EventEmitter} eventemitter EventEmitter where we emit our events on.
 * @param {Object} options Configuration
 * @api public
 */
function Recovery(eventemitter, options) {
  if (!(this instanceof Recovery)) return new Recovery(eventemitter, options);
  options = options || {};

  this.fn = null;             // Stores the callback.
  this.attempt = null;        // Stores the current reconnect attempt.
  this.events = eventemitter;

  this.max = this.default('max', options);
  this.min = this.default('min', options);
  this.factor = this.default('factor', options);
  this.retries = this.default('retries', options);
  this.timeout = this.default('timeout', options);

  Tick.call(this);
}

Recovery.prototype = new Tick();
Recovery.prototype.constructor = Recovery;

Recovery.max = Infinity;          // Maximum delay.
Recovery.min = '500 ms';          // Minimum delay.
Recovery.retries = 10;            // Maximum amount of retries.
Recovery.factor = 2;              // Exponential back off factor.
Recovery.timeout = '30 seconds';  // Maximum timeout for the request to answer.

/**
 * Returns sane defaults about a given value.
 *
 * @param {String} name Name of property we want>
 * @param {Object} opts User supplied options we want to check.
 * @returns {Number} Some default value.
 * @api private
 */
Recovery.prototype.default = function defaults(name, opts) {
  return millisecond(
    name in opts ? opts[name] : (name in this ? this[name] : Recovery[name])
  );
};

/**
 * Start a new reconnect procedure.
 *
 * @returns {Recovery}
 * @api public
 */
Recovery.prototype.reconnect = function reconnect() {
  var recovery = this;

  return this.backoff(function backedoff(err, opts) {
    opts.duration = (+new Date()) - opts.start;
    recovery.reset();

    if (err) return recovery.events.emit('reconnect failed', err, opts);
    recovery.events.emit('reconnected', opts);
  }, this.attempt);
};

/**
 * Reconnecting failed. Start over again.
 *
 * @param {Error} err Optional error message.
 * @returns {Boolean} Successfully notified of failure.
 * @api public
 */
Recovery.prototype.failed = function failed(err) {
  if ('function' === typeof this.fn) {
    this.fn(err || new Error('Failed to reconnect'));
    return true;
  }

  return false;
};

/**
 * Successful reconnect. Clean up things.
 *
 * @returns {Boolean} Successfully notified of success.
 * @api public
 */
Recovery.prototype.success = function success() {
  if ('function' === typeof this.fn) {
    this.fn();
    return true;
  }

  return false;
};

/**
 * Exponential back off algorithm for retry operations. It uses an randomized
 * retry so we don't DDOS our server when it goes down under pressure.
 *
 * @param {Function} fn Callback to be called after the timeout.
 * @param {Object} opts Options for configuring the timeout.
 * @returns {Recovery}
 * @api private
 */
Recovery.prototype.backoff = function backoff(fn, opts) {
  var recovery = this;

  opts = opts || recovery.attempt || {};

  //
  // Bailout when we already have a back off process running. We shouldn't call
  // the callback then.
  //
  if (opts.backoff) return recovery;

  opts.max = recovery.default('max', opts);
  opts.min = recovery.default('min', opts);
  opts.factor = recovery.default('factor', opts);
  opts.retries = recovery.default('retries', opts);
  opts.timeout = recovery.default('timeout', opts);

  opts.start = +opts.start || +new Date();
  opts.duration = +opts.duration || 0;
  opts.attempt = +opts.attempt || 0;

  //
  // Bailout if we are about to make to much attempts. Please note that we use
  // `>` because we already incremented the value above.
  //
  if (opts.attempt === opts.retries) {
    fn.call(recovery, new Error('Unable to recover'), opts);
    return recovery;
  }

  //
  // Prevent duplicate back off attempts using the same options object and
  // increment our attempt as we're about to have another go at this thing.
  //
  opts.backoff = true;
  opts.attempt++;

  recovery.attempt = opts;

  //
  // Calculate the timeout, but make it randomly so we don't retry connections
  // at the same interval and defeat the purpose. This exponential back off is
  // based on the work of:
  //
  // http://dthain.blogspot.nl/2009/02/exponential-backoff-in-distributed.html
  //
  opts.scheduled = opts.attempt !== 1
    ? Math.min(Math.round(
        (Math.random() + 1) * opts.min * Math.pow(opts.factor, opts.attempt)
      ), opts.max)
    : opts.min;

  recovery.setTimeout('reconnect', function delay() {
    opts.duration = (+new Date()) - opts.start;
    opts.backoff = false;
    recovery.clear();

    //
    // Create a `one` function which can only be called once. So we can use the
    // same function for different types of invocations to create a much better
    // and usable API.
    //
    var connect = recovery.fn = one(function connect(err) {
      if (err) {
        recovery.clear();
        return recovery.backoff(fn, opts);
      }

      fn.call(recovery, undefined, opts);
    });

    recovery.events.emit('reconnect', opts);
    recovery.setTimeout('timeout', function timeout() {
      var err = new Error('Failed to reconnect in a timely manner');
      opts.duration = (+new Date()) - opts.start;

      recovery.events.emit('reconnect timeout', err, opts);
      connect(err);
    }, opts.timeout);
  }, opts.scheduled);

  //
  // Emit a `reconnecting` event with current reconnect options. This allows
  // them to update the UI and provide their users with feedback.
  //
  recovery.events.emit('reconnecting', opts);

  return recovery;
};

/**
 * Reset the reconnection attempt so it can be re-used again.
 *
 * @api public
 */
Recovery.prototype.reset = function reset() {
  this.fn = this.attempt = null;
  return this.clear();
};

/**
 * Destroy the recovery instance and leave no traces around.
 *
 * @returns {Boolean} Successful destruction
 * @api public
 */
Recovery.prototype.end = Recovery.prototype.destroy = function destroy() {
  if (!this.events) return false;

  this.reset();
  this.events = null;

  return true;
};

/**
 * Check if the reconnection process is currently active.
 *
 * @returns {Boolean}
 * @api public
 */
Recovery.prototype.active = function active() {
  return !!this.attempt;
};

//
// Expose the module.
//
module.exports = Recovery;
