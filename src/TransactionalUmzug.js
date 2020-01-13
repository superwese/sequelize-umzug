import {Umzug} from './index';

export default class TransactionalUmzug extends Umzug {

  constructor(options = {}) {
    super(options);
    this.sequelize = options.storageOptions.sequelize;
  }
  /**
   * Executes given migrations with a given method.
   *
   * @param {Object}   [options]
   * @param {String[]} [options.migrations=[]]
   * @param {String}   [options.method='up']
   * @returns {Promise}
   */
  execute (options = {}) {
    const self = this;

    options = {
      migrations: [],
      method: 'up',
      ...options,
    };

    return Bluebird
      .map(options.migrations, (migration) => self._findMigration(migration))
      .then((migrations) => ({
        ...options,
        migrations,
      }))
      .then((options) => {
        return Bluebird.each(options.migrations, (migration) => {

          const name = path.basename(migration.file, path.extname(migration.file));
          let startTime;
          return self
            ._wasExecuted(migration)
            .catch(() => false)
            .then((executed) => (typeof executed === 'undefined') ? true : executed)
            .then((executed) => {
              if (!executed || (options.method === 'down')) {
                const fun = (migration[options.method] || Bluebird.resolve);
                let params = self.options.migrations.params;

                if (typeof params === 'function') {
                  params = params();
                }

                if (options.method === 'up') {
                  self.log('== ' + name + ': migrating =======');
                  self.emit('migrating', name, migration);
                } else {
                  self.log('== ' + name + ': reverting =======');
                  self.emit('reverting', name, migration);
                }

                return self.sequelize.transaction(t => {
                  startTime = new Date();
                  params.transaction = transaction;
                  return fun.apply(migration, params)
                    .then(() => {
                        if (!executed && (options.method === 'up')) {
                          return Bluebird.resolve(self.storage.logMigration(migration.file));
                        } else if (options.method === 'down') {
                          return Bluebird.resolve(self.storage.unlogMigration(migration.file));
                        }
                      }
                    );
                });

              }
            })

            .then(() => {
              const duration = ((new Date() - startTime) / 1000).toFixed(3);
              if (options.method === 'up') {
                self.log('== ' + name + ': migrated (' + duration + 's)\n');
                self.emit('migrated', name, migration);
              } else {
                self.log('== ' + name + ': reverted (' + duration + 's)\n');
                self.emit('reverted', name, migration);
              }
            })
            .catch(err => {
              // migrate && logMigration didn't work!
              self.log(err);
            })
            ;
        });
      });
  }

}
