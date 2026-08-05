class SystemRegistry {
  constructor() {
    this.systems = new Map();
  }

  register(system) {
    if (!system.id) {
      throw new Error("System registration failed: missing 'id'");
    }
    this.systems.set(system.id, system);
    console.log(`📡 Registered system: ${system.name} (${system.id})`);
  }

  getSystem(id) {
    return this.systems.get(id);
  }

  getAllSystems() {
    return Array.from(this.systems.values());
  }
}

const systemRegistry = new SystemRegistry();
export default systemRegistry;
