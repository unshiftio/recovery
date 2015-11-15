/* istanbul ignore next */
describe('recovery', function () {
  'use strict';

  var assume = require('assume')
    , Recovery = require('./')
    , recovery;

  beforeEach(function () {
    recovery = new Recovery();
  });

  afterEach(function () {
    recovery.reset();
  });

  this.timeout(60000);

  it('is exported as a function', function () {
    assume(Recovery).is.a('function');
  });

  it('returns a new instance if constructed without new', function () {
    assume(Recovery()).is.instanceOf(Recovery);
  });

  describe('#reconnect', function () {
    it('emits `reconnect scheduled` when starting', function (next) {
      recovery.once('reconnect scheduled', function (opts) {
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
      recovery.once('reconnect', function (opts) {
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
      recovery.once('reconnect timeout', function (err, opts) {
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

      recovery['reconnect timeout'] = 100;
      recovery.reconnect();
    });

    it('emits `reconnect failed` when all attempts failed', function (next) {
      var start = +new Date()
        , attempts = 0;

      recovery.on('reconnect scheduled', function (opts) {
        var elapsed = +new Date() - start;

        attempts++;

        assume(opts.attempt).to.equal(attempts);
        assume(opts.retries).to.equal(recovery.retries);
        assume(opts.max).to.equal(recovery.max);
        assume(opts.mix).to.equal(recovery.mix);
        assume(opts.scheduled).is.least(opts.min);
        assume(opts.scheduled).is.most(opts.max);

        if (attempts === 1) return;

        assume(opts.duration).is.lte(elapsed);
        assume(opts.duration).is.gte(elapsed - 20);
      });

      recovery.on('reconnect timeout', function (err, opts) {
        assume(opts.attempt).to.equal(attempts);
      });

      recovery.on('reconnect failed', function (err, opts) {
        var elapsed = +new Date() - start;

        assume(err).is.a('error');
        assume(err.message).contains('recover');

        assume(opts.attempt).to.equal(recovery.retries);
        assume(opts.attempt).to.equal(opts.retries);
        assume(opts.duration).is.lte(elapsed);
        assume(opts.duration).is.gte(elapsed - 20);

        assume(recovery._fn).to.equal(null);

        next();
      });

      recovery['reconnect timeout'] = 100;
      recovery.max = 2000;
      recovery.reconnect();
    });

    it('emits a `reconnected` event for a successful connection', function (next) {
      var start = +new Date();

      recovery.on('reconnected', function (opts) {
        var elapsed = +new Date() - start;

        assume(opts.attempt).equals(2);
        assume(opts.duration).is.lte(elapsed);
        assume(opts.duration).is.gte(elapsed - 20);

        assume(recovery._fn).to.equal(null);

        next();
      });

      recovery.on('reconnect', function (opts) {
        if (opts.attempt === 1) return setTimeout(function () {
          recovery.reconnected(new Error('Nope, we failed'));
        }, 50);

        setTimeout(function () {
          recovery.reconnected();
        }, 50);
      });

      recovery['reconnect timeout'] = 100;
      recovery.reconnect();
    });

    it('can use the .reconnected API', function (next) {
      var start = +new Date();

      recovery.on('reconnected', function (opts) {
        var elapsed = +new Date() - start;

        assume(opts.attempt).equals(2);
        assume(opts.duration).is.lte(elapsed);
        assume(opts.duration).is.gte(elapsed - 20);

        assume(recovery._fn).to.equal(null);

        next();
      });

      recovery.on('reconnect', function (opts) {
        if (opts.attempt === 1) return setTimeout(function () {
          recovery.reconnected(new Error('Shit broke'));
        }, 50);

        setTimeout(function () {
          recovery.reconnected();
        }, 50);
      });

      recovery['reconnect timeout'] = 100;
      recovery.reconnect();
    });

    it('can call the reconnected API when no attempt is running', function () {
      recovery.on('reconnected', function () {
        throw new Error('I should not be triggered');
      });

      recovery.reconnected();
    });

    it('doesnt allow another reconnection attempt while busy', function (next) {
      var attempts = 0;

      recovery.on('reconnect', function () {
        recovery.reconnected();
      });

      recovery.on('reconnected', function () {
        next();
      });

      recovery.on('reconnect scheduled', function () {
        attempts++;

        if (attempts > 1) throw new Error('I should only reconnect once');
      });

      recovery['reconnect timeout'] = 100;
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

  describe('#reconnecting', function () {
    it('returns a boolean', function (next) {
      assume(recovery.reconnecting()).equals(false);

      recovery.on('reconnected', function () {
        assume(recovery.reconnecting()).equals(false);
        next();
      });

      recovery.on('reconnect scheduled', function () {
        assume(recovery.reconnecting()).equals(true);
      });

      recovery.on('reconnect', function () {
        assume(recovery.reconnecting()).equals(true);

        setTimeout(function () {
          recovery.reconnected();
        }, 50);
      });

      recovery['reconnect timeout'] = 100;
      recovery.reconnect();
      assume(recovery.reconnecting()).equals(true);
    });
  });

  describe('#reset', function () {
    it('only removes our assigned listeners', function (next) {
      recovery.timers.setTimeout('next', next, 25);
      recovery.reconnect();

      setTimeout(function () {
        recovery.reset();
        assume(recovery._fn).equals(null);
        assume(recovery.attempt).equals(null);

        assume(recovery.timers.active('reconnect')).equals(false);
        assume(recovery.timers.active('timeout')).equals(false);
        assume(recovery.timers.active('next')).equals(true);
      }, 0);
    });
  });
});
