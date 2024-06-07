import "../js/d3.min.js";

/** Graph configs */
const margin = { top: 10, right: 30, bottom: 20, left: 50 };
const width =
  document.getElementById("map").offsetWidth - margin.left - margin.right;
const height = width - margin.top - margin.bottom;

const init = async () => {
  let selectedData = "Confirmed";
  const svg = d3
    .select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "gray");

  /** Create caption */
  d3.select("#chart")
    .append("figcaption")
    .text("COVID-19 Time Series Data Australia");

  const projection = d3
    .geoMercator()
    .center([131, -30])
    .translate([width / 2, height / 2])
    .scale((700 * 530) / width);

  const path = d3.geoPath().projection(projection);

  // AU states.json from https://github.com/rowanhogan/australian-states/blob/master/states.geojson
  const { features, ...fields } = await d3.json("../assets/states.geojson");

  const auCovidDataConfirmed = await d3.csv(
    "../assets/time_series_au_covid19_confirmed.csv"
  );
  const auCovidDataDeaths = await d3.csv(
    "../assets/time_series_au_covid19_deaths.csv"
  );
  const auCovidDataRecovered = await d3.csv(
    "../assets/time_series_au_covid19_recovered.csv"
  );

  // reduce dates
  const dates = auCovidDataDeaths.columns.slice(
    4,
    auCovidDataDeaths.columns.length
  );

  const defaultDate = dates[dates.length - 1];
  let date = defaultDate;

  const tooltip = d3.select("#tooltip").style("visibility", "hidden");
  const dateSelector = d3.select("#map-date");

  dateSelector.text(date);

  const drawGraph = () => {
    let dataset = auCovidDataConfirmed;

    if (selectedData === "Deaths") {
      dataset = auCovidDataDeaths;
    }
    if (selectedData === "Recovered") {
      dataset = auCovidDataRecovered;
    }
    if (selectedData === "Confirmed") {
      dataset = auCovidDataConfirmed;
    }

    // reduce data from dates
    const reducedData = dataset.map((d) => {
      return {
        State: d.State,
        value: parseInt(d[date]),
      };
    });

    const mergedData = features.map(
      ({ properties: { STATE_NAME, ...propertyFields }, ...fields }) => {
        const data = reducedData.find((d) => d.State === STATE_NAME);
        return {
          ...fields,
          properties: {
            ...propertyFields,
            STATE_NAME,
            value: data.value,
          },
        };
      }
    );

    // flatmap
    const flattenedData = dataset.flatMap(
      ({ State, Country, Long, Lat, ...dates }) =>
        Object.keys(dates).map((k) => parseInt(dates[k]))
    );

    const max = d3.max(flattenedData, (d) => d);

    const color = d3.scaleLinear().range(d3.schemeBlues[3]).domain([0, max]);

    const states = svg.selectAll("path").data(mergedData, (d) => d);

    states
      .enter()
      .append("path")
      .attr("d", path)
      .style("fill", (d) => color(d.properties.value))
      .on("mouseover", function (event, d) {
        tooltip.style("visibility", "visible");
        tooltip.select("#tooltip-title").text(d.properties.STATE_NAME);
        tooltip
          .select("#tooltip-content")
          .text(
            `${selectedData}: ${d.properties.value
              .toString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
          );
      })
      .on("mouseleave", (event) => {
        const el = d3.select(event.target);
        el.attr("fill", "black");
        tooltip.style("visibility", "hidden");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", (event.clientY - 10).toString() + "px")
          .style("left", (event.clientX + 10).toString() + "px");
      });
  };

  drawGraph(features);

  d3.select("#map-date-slider").on("input", (e) => {
    date = dates[Math.round((e.target.value / 100) * (dates.length - 1))];
    dateSelector.text(date);
    drawGraph();
  });

  d3.select("#map-var-select").on("change", (e) => {
    selectedData = e.target.value;
    console.log(selectedData);
    drawGraph();
  });
};

init();
