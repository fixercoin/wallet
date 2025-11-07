const tradeRoomsStore = new Map();
const tradeMessagesStore = new Map();

const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export async function handleListTradeRooms(req, res) {
  try {
    const rooms = Array.from(tradeRoomsStore.values());
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: "Failed to list trade rooms" });
  }
}

export async function handleCreateTradeRoom(req, res) {
  try {
    const { name, description } = req.body;

    const roomId = generateId("ROOM");
    const room = {
      id: roomId,
      name,
      description,
      createdAt: Date.now(),
      memberCount: 0,
    };

    tradeRoomsStore.set(roomId, room);
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: "Failed to create trade room" });
  }
}

export async function handleGetTradeRoom(req, res) {
  try {
    const { roomId } = req.params;
    const room = tradeRoomsStore.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ error: "Failed to get trade room" });
  }
}

export async function handleUpdateTradeRoom(req, res) {
  try {
    const { roomId } = req.params;
    const { name, description } = req.body;

    const room = tradeRoomsStore.get(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (name) room.name = name;
    if (description) room.description = description;

    tradeRoomsStore.set(roomId, room);
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: "Failed to update trade room" });
  }
}

export async function handleListTradeMessages(req, res) {
  try {
    const { roomId } = req.params;
    const messages = Array.from(tradeMessagesStore.values()).filter(
      (m) => m.roomId === roomId,
    );

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to list trade messages" });
  }
}

export async function handleAddTradeMessage(req, res) {
  try {
    const { roomId } = req.params;
    const { text, userId } = req.body;

    const messageId = generateId("MSG");
    const message = {
      id: messageId,
      roomId,
      text,
      userId,
      createdAt: Date.now(),
    };

    tradeMessagesStore.set(messageId, message);
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to add trade message" });
  }
}
