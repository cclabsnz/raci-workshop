import type * as Party from "partykit/server";

interface Participant {
  name: string;
  color: string;
  answers: Record<string, string>;
  connId: string;
}

interface CustomActivity {
  id: string;
  domainId: string;
  activity: string;
  addedBy: string;
}

interface Role {
  id: string;
  label: string;
  full: string;
}

interface RoomState {
  participants: Record<string, Participant>;
  customActivities: CustomActivity[];
  deletedActivityIds: string[];
  roles: Role[];
  creatorName: string;
}

const DEFAULT_ROLES: Role[] = [
  { id: "ssa", label: "SSA", full: "Senior Solution Architect" },
  { id: "pa",  label: "PA",  full: "Principal Advisor — SF Delivery" },
  { id: "pm",  label: "PM",  full: "Platform Manager" },
  { id: "dol", label: "DOL", full: "DevOps Lead" },
  { id: "ptl", label: "PTL", full: "Platform Technical Lead" },
];

const COLORS = [
  "#534AB7", "#1D9E75", "#D85A30", "#185FA5", "#D4537E",
  "#639922", "#BA7517", "#993556", "#5F5E5A", "#E24B4A",
];

export default class RACIServer implements Party.Server {
  state: RoomState = {
    participants: {},
    customActivities: [],
    deletedActivityIds: [],
    roles: [...DEFAULT_ROLES],
    creatorName: "",
  };
  colorIndex = 0;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({
      type: "sync",
      participants: this.state.participants,
      customActivities: this.state.customActivities,
      deletedActivityIds: this.state.deletedActivityIds,
      roles: this.state.roles,
      creatorName: this.state.creatorName,
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message);

    switch (msg.type) {
      case "join": {
        const name = msg.name?.trim();
        if (!name) return;
        if (!this.state.creatorName) {
          this.state.creatorName = name;
          // Accept initial role config from creator
          if (msg.roles && Array.isArray(msg.roles) && msg.roles.length > 0) {
            this.state.roles = msg.roles;
          }
        }
        if (this.state.participants[name]) {
          this.state.participants[name].connId = sender.id;
        } else {
          this.state.participants[name] = {
            name,
            color: COLORS[this.colorIndex++ % COLORS.length],
            answers: {},
            connId: sender.id,
          };
        }
        this.broadcast();
        break;
      }

      case "close_room": {
        const p = this.findParticipant(sender.id);
        if (!p || p.name !== this.state.creatorName) return;
        this.room.broadcast(JSON.stringify({ type: "room_closed" }));
        break;
      }

      case "answer": {
        const p = this.findParticipant(sender.id);
        if (!p) return;
        if (msg.value) {
          p.answers[msg.key] = msg.value;
        } else {
          delete p.answers[msg.key];
        }
        this.broadcast();
        break;
      }

      case "bulk_answers": {
        const p = this.findParticipant(sender.id);
        if (!p) return;
        if (msg.answers && typeof msg.answers === "object") {
          p.answers = msg.answers;
          this.broadcast();
        }
        break;
      }

      case "clear_role": {
        const p = this.findParticipant(sender.id);
        if (!p) return;
        const prefix = msg.roleId + ":";
        Object.keys(p.answers).forEach((k) => {
          if (k.startsWith(prefix)) delete p.answers[k];
        });
        this.broadcast();
        break;
      }

      case "add_activity": {
        const p = this.findParticipant(sender.id);
        if (!p) return;
        this.state.customActivities.push({
          id: msg.id,
          domainId: msg.domainId,
          activity: msg.activity,
          addedBy: p.name,
        });
        this.broadcast();
        break;
      }

      case "remove_activity": {
        const id: string = msg.id;
        if (id.startsWith("b")) {
          // Base activity — add to deleted list
          if (!this.state.deletedActivityIds.includes(id)) {
            this.state.deletedActivityIds.push(id);
          }
        } else {
          // Custom activity — remove entirely
          this.state.customActivities = this.state.customActivities.filter(
            (a) => a.id !== id
          );
        }
        // Clean up all participant answers referencing this activity
        Object.values(this.state.participants).forEach((p) => {
          Object.keys(p.answers).forEach((k) => {
            if (k.endsWith(":" + id)) delete p.answers[k];
          });
        });
        this.broadcast();
        break;
      }

      case "add_role": {
        const label = (msg.label ?? "").trim().toUpperCase().slice(0, 8);
        const full  = (msg.full  ?? "").trim().slice(0, 60);
        if (!label || !full) return;
        const id = "cr_" + Date.now();
        this.state.roles.push({ id, label, full });
        this.broadcast();
        break;
      }

      case "remove_role": {
        const roleId: string = msg.roleId;
        if (!roleId) return;
        this.state.roles = this.state.roles.filter((r) => r.id !== roleId);
        // Clean up all participant answers for this role
        Object.values(this.state.participants).forEach((p) => {
          Object.keys(p.answers).forEach((k) => {
            if (k.startsWith(roleId + ":")) delete p.answers[k];
          });
        });
        this.broadcast();
        break;
      }
    }
  }

  onClose(_conn: Party.Connection) {
    // Don't remove participant on disconnect — they might rejoin
  }

  findParticipant(connId: string): Participant | undefined {
    return Object.values(this.state.participants).find(
      (p) => p.connId === connId
    );
  }

  broadcast() {
    this.room.broadcast(JSON.stringify({
      type: "sync",
      participants: this.state.participants,
      customActivities: this.state.customActivities,
      deletedActivityIds: this.state.deletedActivityIds,
      roles: this.state.roles,
      creatorName: this.state.creatorName,
    }));
  }
}

RACIServer satisfies Party.Worker;
