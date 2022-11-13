const STATE = {
  FULLFILLED: "fulfilled",
  REJECTED: "rejected",
  PENDING: "pending",
};

class MyPromise {
  #thenCbs = [];
  #catchCbs = [];
  #value;
  #state = STATE.PENDING;
  #onSuccessBind = this.#onSuccess.bind(this);
  #onFailBind = this.#onFail.bind(this);

  constructor(cb) {
    try {
      cb(this.#onSuccessBind, this.#onFailBind);
    } catch (err) {
      this.#onFail(err);
    }
  }

  #runCallbacks() {
    if (this.#state === STATE.FULLFILLED) {
      this.#thenCbs.forEach((cb) => cb(this.#value));

      this.#thenCbs = [];
    }

    if (this.#state === STATE.REJECTED) {
      this.#catchCbs.forEach((cb) => cb(this.#value));

      this.#catchCbs = [];
    }
  }

  #onSuccess(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) {
        return;
      }

      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind);
        return;
      }

      this.#value = value;
      this.#state = STATE.FULLFILLED;
      this.#runCallbacks();
    });
  }

  #onFail(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) {
        return;
      }

      if (value instanceof MyPromise) {
        value.then(this.#onSuccessBind, this.#onFailBind);
        return;
      }

      if (this.#catchCbs.length === 0) {
        throw new UncaughtPromiseError(value);
      }

      this.#value = value;
      this.#state = STATE.REJECTED;
      this.#runCallbacks();
    });
  }

  then(thenCb, catchCb) {
    return new MyPromise((resolve, reject) => {
      this.#thenCbs.push((result) => {
        if (!thenCb) {
          resolve(result);
          return;
        }

        try {
          resolve(thenCb(result));
        } catch (err) {
          reject(err);
        }
      });

      this.#catchCbs.push((result) => {
        if (!catchCb) {
          reject(result);
          return;
        }

        try {
          resolve(catchCb(result));
        } catch (err) {
          reject(err);
        }
      });

      this.#runCallbacks();
    });
  }

  catch(cb) {
    return this.then(undefined, cb);
  }

  finally(cb) {
    return this.then(
      (result) => {
        cb();
        return result;
      },
      (result) => {
        cb();
        throw result;
      }
    );
  }

  static resolve(value) {
    return new MyPromise((res) => res(value));
  }

  static reject(value) {
    return new MyPromise((_, rej) => rej(value));
  }

  static all(promises) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((res, rej) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then((result) => {
            results[i] = result;
            completedPromises++;
            if (completedPromises === promises.length) {
              res(results);
            }
          })
          .catch(rej);
      }
    });
  }

  static allSettled(promises = []) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((res, rej) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise
          .then((value) => {
            results[i] = { status: STATE.FULLFILLED, value };
          })
          .catch((reason) => {
            results[i] = { status: STATE.REJECTED, reason };
          })
          .finally(() => {
            completedPromises++;
            if (completedPromises === promises.length) {
              res(results);
            }
          });
      }
    });
  }

  static race(promises = []) {
    return new MyPromise((resolve, reject) => {
      promises.forEach((promise) => {
        promise.then(resolve).catch(reject);
      });
    });
  }

  static any(promises = []) {
    const results = [];
    let completedPromises = 0;
    return new MyPromise((res, rej) => {
      for (let i = 0; i < promises.length; i++) {
        const promise = promises[i];
        promise.then(res).catch((err) => {
          results[i] = err;
          completedPromises++;
          if (completedPromises === promises.length) {
            rej(new AggregateError(results, "All promises were rejected"));
          }
        });
      }
    });
  }
}

class UncaughtPromiseError extends Error {
  constructor(error) {
    super(error);
    this.stack = `(in promise) ${error.stack}`;
  }
}

module.exports = MyPromise;
