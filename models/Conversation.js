import { DataTypes } from 'sequelize';
import sequelize from '../database/connection.js';

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Nueva conversación',
  },
  mode: {
    type: DataTypes.STRING,
    defaultValue: 'guia',
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
  },
});

export default Conversation;
