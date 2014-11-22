describe('recovery', function () {
  'use strict';

  var EventEmitter = require('events').EventEmitter
    , Tick = require('tick-tock')
    , assume = require('assume')
    , Recovery = require('./')
    , recovery
    , emitter;

  beforeEach(function () {
    emitter = new EventEmitter();
    recovery = new Recovery(emitter);
  });

  afterEach(function () {
    recovery.destroy();
  });

  this.timeout(60000);

  it('is exported as a function', function () {
    assume(Recovery).is.a('function');
  });

  it('returns a new instance if constructed without new', function () {
    recovery = Recovery(emitter);
    assume(recovery).is.instanceOf(Recovery);
  });

  describe('#default', function () {
    var opts = {
      min: 1000
    };

    it('finds the property in the supplied object', function () {
      assume(recovery.default('min', opts)).to.equal(opts.min);
      assume(recovery.default('min', {})).to.not.equal(opts.min);
    });

    it('defaults to the value specified on the constructor', function () {
      recovery.min = 4241;

      assume(recovery.default('min', {})).to.equal(4241);
    });

    it('automatically transforms the value to a number', function () {
      delete recovery.min;

      assume(Recovery.min).to.be.a('string');
      assume(recovery.default('min', {})).to.a('number');
    });

    it('defaults to the "global" Recovery instance', function () {
      delete recovery.min;

      assume(recovery.default('min', {})).to.equal(Tick.parse(Recovery.min));
    });

    it('integrates in the constructor', function () {
      assume(recovery.min).to.equal(Tick.parse(Recovery.min));
      assume(Recovery.min).to.not.equal(10);

      Recovery.min = 10;
      recovery = new Recovery();
      assume(recovery.min).to.equal(Tick.parse(Recovery.min));
      assume(Recovery.min).to.equal(10);
    });
  });

  describe('#reconnect', function () {
    it('emits `reconnecting` when starting', function (next) {
      emitter.once('reconnecting', function (opts) {
        assume(opts).is.a('object');
        assume(opts.attempt).to.equal(1);
        assume(opts.retries).to.equal(recovery.retries);
        assume(opts.max).to.equal(recovery.max);
        assume(opts.mix).to.equal(recovery.mix);
        assume(opts.scheduled).is.least(opts.min);
        assume(opts.scheduled).is.most(opts.max);
        assume(opts.duration).is.equal(0);

        next();
      });

      recovery.reconnect();
    });

    it('emits `reconnect` when you need to start the reconnect', function (next) {
      emitter.once('reconnect', function (opts) {
        assume(opts).is.a('object');
        assume(opts.attempt).to.equal(1);
        assume(opts.retries).to.equal(recovery.retries);
        assume(opts.max).to.equal(recovery.max);
        assume(opts.mix).to.equal(recovery.mix);
        assume(opts.scheduled).is.least(opts.min);
        assume(opts.scheduled).is.most(opts.max);

        next();
      });

      recovery.reconnect();
    });

    it('emits `reconnect timeout` when the reconnect attempt timed out', function (next) {
      emitter.once('reconnect timeout', function (err, opts) {
        assume(err).is.a('error');
        assume(err.message).contains('time');

        assume(opts).is.a('object');
        assume(opts.attempt).to.equal(1);
        assume(opts.retries).to.equal(recovery.retries);
        assume(opts.max).to.equal(recovery.max);
        assume(opts.mix).to.equal(recovery.mix);
        assume(opts.scheduled).is.least(opts.min);
        assume(opts.scheduled).is.most(opts.max);

        next();
      });

      recovery.timeout = 100;
      recovery.reconnect();
    });

    it('emits `reconnect failed` when all attempts failed', function (next) {
      var attempts = 0
        , start = Date.now();

      emitter.on('reconnecting', function (opts) {
        attempts++;

        assume(opts.attempt).to.equal(attempts);
        assume(opts.retries).to.equal(recovery.retries);
        assume(opts.max).to.equal(recovery.max);
        assume(opts.mix).to.equal(recovery.mix);
        assume(opts.scheduled).is.least(opts.min);
        assume(opts.scheduled).is.most(opts.max);

        if (attempts === 1) return;

        assume(opts.duration).to.most(Date.now() - start);
        assume(opts.duration).to.least((Date.now() - start) - 10);
      });

      emitter.on('reconnect timeout', function (err, opts) {
        assume(opts.attempt).to.equal(attempts);
      });

      emitter.on('reconnect failed', function (err, opts) {
        assume(err).is.a('error');
        assume(err.message).contains('recover');

        assume(opts.attempt).to.equal(recovery.retries);
        assume(opts.attempt).to.equal(opts.retries);
        assume(opts.duration).to.most(Date.now() - start);
        assume(opts.duration).to.least((Date.now() - start) - 10);

        assume(recovery.fn).to.equal(null);
        assume(recovery.failed()).is.false();
        assume(recovery.success()).is.false();

        next();
      });

      recovery.timeout = 100;
      recovery.max = 2000;
      recovery.reconnect();
    });

    it('emits a `reconnected` event for a successful connection', function (next) {
      var start = Date.now();

      emitter.on('reconnected', function (opts) {
        assume(opts.attempt).equals(2);
        assume(opts.duration).to.most(Date.now() - start);
        assume(opts.duration).to.least((Date.now() - start) - 10);

        assume(recovery.fn).to.equal(null);
        assume(recovery.failed()).is.false();
        assume(recovery.success()).is.false();

        next();
      });

      emitter.on('reconnect', function (opts) {
        if (opts.attempt === 1) return setTimeout(function () {
          recovery.failed(new Error('Nope, we failed'));
        }, 50);

        setTimeout(function () {
          recovery.success();
        }, 50);
      });

      recovery.timeout = 100;
      recovery.reconnect();
    });

    it('can use the .success and .failed APIs', function (next) {
      var start = Date.now();

      emitter.on('reconnected', function (opts) {
        assume(opts.attempt).equals(2);
        assume(opts.duration).to.most(Date.now() - start);
        assume(opts.duration).to.least((Date.now() - start) - 10);

        assume(recovery.fn).to.equal(null);
        assume(recovery.failed()).is.false();
        assume(recovery.success()).is.false();

        next();
      });

      emitter.on('reconnect', function (opts) {
        if (opts.attempt === 1) return setTimeout(function () {
          assume(recovery.failed()).is.true();
        }, 50);

        setTimeout(function () {
          assume(recovery.success()).is.true();
        }, 50);
      });

      recovery.timeout = 100;
      recovery.reconnect();
    });

    it('doesnt allow another reconnection attempt while busy', function (next) {
      var attempts = 0;

      emitter.on('reconnect', function () {
        recovery.success();
      });

      emitter.on('reconnected', function () {
        next();
      });

      emitter.on('reconnecting', function (fn, opts) {
        attempts++;

        if (attempts > 1) throw new Error('I should only reconnect once');
      });

      recovery.timeout = 100;
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
      recovery.reconnect();
    });
  });

  describe('#active', function () {
    it('returns a boolean', function (next) {
      assume(recovery.active()).is.false();

      emitter.on('reconnected', function (opts) {
        assume(recovery.active()).is.false();
        next();
      });

      emitter.on('reconnecting', function () {
        assume(recovery.active()).is.true();
      });

      emitter.on('reconnect', function (opts) {
        assume(recovery.active()).is.true();

        setTimeout(function () {
         recovery.success();
        }, 50);
      });

      recovery.timeout = 100;
      recovery.reconnect();
      assume(recovery.active()).is.true();
    });
  });

  describe('#destroy', function () {
    it('returns true for the first time', function () {
      assume(recovery.destroy()).is.true();
    });

    it('returns false for the second call', function () {
      assume(recovery.destroy()).is.true();
      assume(recovery.destroy()).is.false();
      assume(recovery.destroy()).is.false();
    });
  });
});
