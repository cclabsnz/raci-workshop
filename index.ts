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

interface RoomState {
  participants: Record<string, Participant>;
  customActivities: CustomActivity[];
}

const COLORS = [
  "#534AB7", "#1D9E75", "#D85A30", "#185FA5", "#D4537E",
  "#639922", "#BA7517", "#993556", "#5F5E5A", "#E24B4A",
];

export default class RACIServer implements Party.Server {
  state: RoomState = { participants: {}, customActivities: [] };
  colorIndex = 0;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Send current state to the new connection
    conn.send(JSON.stringify({
      type: "sync",
      participants: this.state.participants,
      customActivities: this.state.customActivities,
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message);

    switch (msg.type) {
      case "join": {
        const name = msg.name?.trim();
        if (!name) return;
        // If name already taken by a disconnected user, reclaim it
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
        this.state.customActivities = this.state.customActivities.filter(
          (a) => a.id !== msg.id
        );
        // Also remove all answers referencing this activity
        Object.values(this.state.participants).forEach((p) => {
          Object.keys(p.answers).forEach((k) => {
            if (k.includes(":" + msg.id)) delete p.answers[k];
          });
        });
        this.broadcast();
        break;
      }

      case "bulk_answers": {
        const p = this.findParticipant(sender.id);
        if (!p) return;
        p.answers = { ...p.answers, ...(msg.answers || {}) };
        this.broadcast();
        break;
      }

      case "import_session": {
        const importedParticipants: Record<string, any> = msg.participants || {};
        const importedActivities: CustomActivity[] = msg.customActivities || [];
        // Merge participants: imported answers fill gaps, don't overwrite live answers
        for (const [name, data] of Object.entries(importedParticipants)) {
          const imported = (data as any).answers || {};
          if (!this.state.participants[name]) {
            this.state.participants[name] = {
              name,
              color: COLORS[this.colorIndex++ % COLORS.length],
              answers: imported,
              connId: "",
            };
          } else {
            // Live participant: keep their answers, only fill in missing keys
            const existing = this.state.participants[name].answers;
            this.state.participants[name].answers = { ...imported, ...existing };
          }
        }
        // Add custom activities not already present
        const existingIds = new Set(this.state.customActivities.map((a) => a.id));
        for (const activity of importedActivities) {
          if (!existingIds.has(activity.id)) {
            this.state.customActivities.push(activity);
          }
        }
        this.broadcast();
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    // Don't remove participant on disconnect — they might rejoin
    // Room auto-expires when all connections close (PartyKit default)
  }

  findParticipant(connId: string): Participant | undefined {
    return Object.values(this.state.participants).find(
      (p) => p.connId === connId
    );
  }

  broadcast() {
    this.room.broadcast(
      JSON.stringify({
        type: "sync",
        participants: this.state.participants,
        customActivities: this.state.customActivities,
      })
    );
  }
}

RACIServer satisfies Party.Worker;