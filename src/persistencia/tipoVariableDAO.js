const { getDatabase } = require('./db');

const sql_create = `INSERT INTO tipo_variable (descriptor) VALUES (?)`;
const sql_getById = `SELECT * FROM tipo_variable WHERE id = ?`;
const sql_getAll = `SELECT * FROM tipo_variable`;
const sql_update = `UPDATE tipo_variable SET descriptor = ? WHERE id = ?`;
const sql_delete = `DELETE FROM tipo_variable WHERE id = ?`;

class TipoVariableDAO {
    
  create(descriptor, callback) {
    const db = getDatabase();    
    
    db.run(sql_create, [descriptor], function (err) {
      if (err) {
        console.error('Error inserting into tipo_variable:', err.message);
        callback(err);
      } else {
        callback(null, { id: this.lastID });
      }
    });
  }

  getById(id, callback) {
    const db = getDatabase();    
    
    db.get(sql_getById, [id], (err, row) => {
      if (err) {
        console.error('Error fetching from tipo_variable:', err.message);
        callback(err);
      } else {
        callback(null, row);
      }
    });
  }

  getAll(callback) {
    const db = getDatabase();    
    
    db.all(sql_getAll, [], (err, rows) => {
      if (err) {
        console.error('Error fetching from tipo_variable:', err.message);
        callback(err);
      } else {
        callback(null, rows);
      }
    });
  }

  update(id, descriptor, callback) {
    const db = getDatabase();    

    db.run(sql_update, [descriptor, id], function(err) {
      if (err) {
        console.error('Error updating tipo_variable:', err.message);
        callback(err);
      } else {
        callback(null, { changes: this.changes });
      }
    });
  }

  delete(id, callback) {    
    const db = getDatabase();    
    
    db.run(sql_delete, [id], function (err) {
      if (err) {
        console.error('Error deleting from tipo_variable:', err.message);
        callback(err);
      } else {
        callback(null, { changes: this.changes });
      }
    });
  }
}

module.exports = TipoVariableDAO;