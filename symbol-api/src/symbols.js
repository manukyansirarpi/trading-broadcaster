import { symbols } from './data';

export default (app) => {
  app.get(
    `/symbols`,
    async (req, res) => {
      try {
        let filteredData = symbols;
        if (req.query.name) {
          filteredData = symbols.filter(symbol => symbol.name === req.query.name);
        }
        res.status(200).send(filteredData);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    }
  );

  app.get(
    `/symbols/:id`,
    async (req, res) => {
      try {
        const filteredData = symbols.filter(symbol => symbol.id === req.params.id);

        if (filteredData.length > 0) {
          return res.status(200).send(filteredData[0]);
        } else {
          return res.status(404).send('');
        }
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    }
  );
};