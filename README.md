# Recovery

[![Build Status](https://travis-ci.org/unshiftio/recovery.svg?branch=master)](https://travis-ci.org/unshiftio/recovery)

Recovery provides randomized exponential back off for reconnection attempts. It
allows you to recover the connection in the most optimal way (for both server
and client). The exponential back off is randomized to prevent a DDOS like
attack on your server when it's restarted, spreading the reconnection attempts
instead of having all your connections attempt to reconnect at exactly the same
time.

### Features

- Reconnection and progress events.
- Randomized exponential back off.
- Reconnection timeouts.
- Browserify compatible.

## Installation

As this module can be used with node.js and browserify it's released in the `npm`
registry and can be installed using:

```
npm install --save recovery
```

## Events

As mentioned in the documentation introduction, this library provides various of
reconnection and progress events. Events **always** receive a "status" or
progress object as last argument. This progress object contains useful
information about current reconnection progress:

- `attempt`:  Which reconnection attempt are we currently processing.
- `start`: Starting time of reconnection attempt.
- `duration`: How long have we taken so far to establish the connection.
- `scheduled`: In how many ms do we schedule the next reconnection attempt.

In addition to these values it also contains all the configuration options like
`retries`, `min`, `max` etc.

The following events are emitted during the recovery process:

Event               | Arguments   | Description
--------------------|-------------|-----------------------------------------------------
`reconnecting`      | status      | Scheduled a new reconnection attempt.
`reconnect`         | fn, status  | It's time for you to reconnect to the server.
`reconnected`       | status      | Successfully reconnected.
`reconnect failed`  | err, status | Failed to reconnect and ran out of attempts.
`reconnect timeout` | err, status | Failed to reconnect in a timely manner, will retry.

## Usage

In all code examples we assume that you've loaded the library using:

```js
'use strict';

var Recovery = require('recovery');
```

To create a new instance of recovery you can supply 2 arguments:

1. Reference to an event listener where we can emit the events on.
2. Optional configuration for the reconnection procedure.

```js
var recovery = new Recovery(eventemitter, {})
```

To make the reconnection process as flexible as possible you can supply us with
a couple of options:

- `max` Maximum reconnection delay. Defaults to `Infinity`.
- `min` Minimum reconnection delay. Defaults to `500 ms`.
- `retries` Maximum amount retries after this we will emit an `reconnect failed` 
  event. Defaults to `10`.
- `timeout` Time you have to reconnect to the server. It takes longer then the
  specified value we will emit an `reconnect timeout` event and schedule another
  reconnection attempt. Defaults to `30 seconds`.
- `factor` Exponential back off factor. Defaults to `2`.

Options that indicate a time can either be set using a human readable string
like `10 seconds`, `1 day`, `10 ms` etc. or a numeric value which represents the
time in milliseconds. 

```js
var recovery = new Recovery(emitter, {
  max: '30 seconds',
  min: '100 milliseconds',
  retries: 5
});
```

### Reconnecting

To know when you've got to reconnect we emit the `reconnect` event. You can
listen to these event on your assigned event emitter. After the event is emitted
we will start our reconnection timeout so you have only a short while to
actually attempt a reconnection again. In a case of a timeout we emit
a `reconnect timeout` event and schedule another attempt.

If you've reconnection attempt is successful call the `reconnect.success()`
method. If it failed you can call the `reconnect.failed()` method. If the
operation failed we will automatically schedule a new reconnect attempt. When
it's successful we will do some small internal clean up and emit the
`reconnected` event. If all future attempts fail we will eventually emit the
`reconnect failed` event which basically indicates that something horrible is
going on.

```js
emitter.on('reconnect', function () {
  reconnectmyconnection(function (err) {
    if (err) return reconnect.failed(err);

    reconnect.success();
  });
});

reconnect = new Recovery(emitter);
reconnect.reconnect();
```

## License

MIT
