import User from './User.js';
import Conversation from './Conversation.js';
import Message from './Message.js';
import sequelize from '../database/connection.js';

// Relations
User.hasMany(Conversation, { foreignKey: 'userId', onDelete: 'CASCADE' });
Conversation.belongsTo(User, { foreignKey: 'userId' });

Conversation.hasMany(Message, { foreignKey: 'conversationId', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });

const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced');
  } catch (error) {
    console.error('Error syncing database:', error);
    throw error;
  }
};

export { User, Conversation, Message, sequelize, syncDatabase };
