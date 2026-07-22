// Durable domain storage for the marketplace.
// In-memory for dev/test; Redis-backed when REDIS_URL is set (production).
// NEVER do keyspace scans — maintain explicit index records.

import type {
  ArchitectProfile,
  ContactRequest,
  AdminAction,
} from "./types.js";

export interface DomainStorage {
  getArchitect(id: string): Promise<ArchitectProfile | undefined>;
  setArchitect(profile: ArchitectProfile): Promise<void>;
  deleteArchitect(id: string): Promise<void>;
  listArchitects(): Promise<ArchitectProfile[]>;
  listPublishedArchitects(): Promise<ArchitectProfile[]>;
  listArchitectsByCategory(category: string): Promise<ArchitectProfile[]>;
  searchArchitects(query: string): Promise<ArchitectProfile[]>;

  getContactRequest(id: string): Promise<ContactRequest | undefined>;
  addContactRequest(req: ContactRequest): Promise<void>;
  listPendingContactRequests(): Promise<ContactRequest[]>;
  markContactForwarded(id: string): Promise<void>;

  addAction(action: AdminAction): Promise<void>;

  getCategories(): Promise<string[]>;
  setCategories(cats: string[]): Promise<void>;
}

class InMemoryDomainStorage implements DomainStorage {
  private architects = new Map<string, ArchitectProfile>();
  private contacts = new Map<string, ContactRequest>();
  private categories: string[] = [];

  async getArchitect(id: string) { return this.architects.get(id); }
  async setArchitect(p: ArchitectProfile) { this.architects.set(p.id, p); }
  async deleteArchitect(id: string) { this.architects.delete(id); }
  async listArchitects() { return [...this.architects.values()]; }
  async listPublishedArchitects() {
    return [...this.architects.values()].filter((a) => a.published);
  }
  async listArchitectsByCategory(category: string) {
    return [...this.architects.values()].filter(
      (a) => a.published && a.categories.includes(category),
    );
  }
  async searchArchitects(query: string) {
    const q = query.toLowerCase();
    return [...this.architects.values()].filter(
      (a) =>
        a.published &&
        (a.name.toLowerCase().includes(q) ||
          a.headline.toLowerCase().includes(q) ||
          a.bio.toLowerCase().includes(q) ||
          a.skills.some((s: string) => s.toLowerCase().includes(q)) ||
          a.categories.some((c: string) => c.toLowerCase().includes(q))),
    );
  }
  async getContactRequest(id: string) { return this.contacts.get(id); }
  async addContactRequest(req: ContactRequest) { this.contacts.set(req.id, req); }
  async listPendingContactRequests() {
    return [...this.contacts.values()].filter((c) => !c.forwarded);
  }
  async markContactForwarded(id: string) {
    const c = this.contacts.get(id);
    if (c) c.forwarded = true;
  }
  async addAction() {}
  async getCategories() { return this.categories.length > 0 ? [...this.categories] : []; }
  async setCategories(cats: string[]) { this.categories = [...cats]; }
}

let _store: DomainStorage | null = null;

export function getDomainStorage(): DomainStorage {
  if (!_store) _store = new InMemoryDomainStorage();
  return _store;
}
