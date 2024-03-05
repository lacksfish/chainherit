// In-memory database, similar to Redis, but with a simpler API and no persistence.

class Redish {
    constructor() {
        if (!Redish.instance) {
            this.store = {}
            this.timeouts = {}
            Redish.instance = this
        }
        return Redish.instance
    }

    set(key, value, mode, duration) {
        this.store[key] = value

        if (mode === 'EX') {
            // Clear previous timeout if it exists
            if (this.timeouts[key]) {
                clearTimeout(this.timeouts[key])
            }

            // Set a new timeout
            this.timeouts[key] = setTimeout(() => {
                delete this.store[key]
                delete this.timeouts[key]
            }, duration * 1000)
        }

        return Promise.resolve("OK")
    }

    get(key) {
        return Promise.resolve(this.store[key] || null)
    }

    del(key) {
        const existed = this.store.hasOwnProperty(key)
        delete this.store[key]
        if (this.timeouts[key]) {
            clearTimeout(this.timeouts[key])
            delete this.timeouts[key]
        }
        return Promise.resolve(existed ? 1 : 0)
    }
}

const instance = new Redish()
Object.freeze(instance)

export default instance