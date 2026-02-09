import User from './User.js';
import Conversation from './Conversation.js';
import Message from './Message.js';
import sequelize from '../database/connection.js';

// Relaciones
User.hasMany(Conversation, { foreignKey: 'userId', onDelete: 'CASCADE' });
Conversation.belongsTo(User, { foreignKey: 'userId' });

Conversation.hasMany(Message, { foreignKey: 'conversationId', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });

const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('📦 Base de datos sincronizada');
  } catch (error) {
    console.error('❌ Error sincronizando base de datos:', error);
  }
};

export { User, Conversation, Message, sequelize, syncDatabase };
