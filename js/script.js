import "./d3.min.js";

/** Create Tooltip */
const tooltip = d3.select("#tooltip").style("visibility", "hidden");

let defaultColorScheme = d3.schemeOranges;
let defaultSecondaryColorScheme = d3.schemeBlues;

const initTimeSeriesGraph = async () => {
  let selectedData = "Confirmed";

  let scrollProgress = 0;

  // AU states.json from https://github.com/rowanhogan/australian-states/blob/master/states.geojson
  const { features, ...fields } = await d3.json("assets/states.geojson");

  const auCovidDataConfirmed = await d3.csv(
    "assets/time_series_au_covid19_confirmed.csv"
  );
  const auCovidDataDeaths = await d3.csv(
    "assets/time_series_au_covid19_deaths.csv"
  );
  const auCovidDataRecovered = await d3.csv(
    "assets/time_series_au_covid19_recovered.csv"
  );

  // reduce dates
  const dates = auCovidDataDeaths.columns.slice(
    4,
    auCovidDataDeaths.columns.length - 1
  );
  const defaultDate = dates[0];
  let date = defaultDate;

  const dateSelector = d3.select("#map-date");

  dateSelector.text(date);

  const drawGraph = () => {
    /** Graph configs */

    const margin = { top: 10, right: 30, bottom: 20, left: 50 };

    const width =
      document.getElementById("map").offsetWidth - margin.left - margin.right;
    const height = (width / 4) * 3;

    d3.select("#map").selectAll("svg").remove();
    let svg = d3
      .select("#map")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "gray");

    const projection = d3
      .geoMercator()
      .center([131, -30])
      .translate([width / 2, height / 2])
      .scale(width);

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
        value: parseInt(d[date] || 0),
      };
    });

    // Bug where d3 ignores first element on update
    const mergedData = [
      {},
      ...features.map(
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
      ),
    ];

    // flatmap
    const flattenedData = dataset.flatMap(
      ({ State, Country, Long, Lat, ...dates }) =>
        Object.keys(dates).map((k) => parseInt(dates[k] || 0))
    );

    const max = d3.max(flattenedData, (d) => d);
    const min = d3.min(flattenedData, (d) => d);

    const color = d3
      .scaleQuantize()
      .range(defaultColorScheme[9])
      .domain([min, max]);

    const path = d3.geoPath().projection(projection);
    const states = svg.selectAll("path").data(mergedData, (d) => d);
    states
      .enter()
      .append("path")
      .attr("d", path)
      .style("stroke", "white")
      .style("stroke-width", "0.5")
      .style("fill", (d) => color(d?.properties?.value))
      .on("mouseover", function (event, d) {
        tooltip.style("visibility", "visible");
        tooltip.select("#tooltip-title").text(d?.properties?.STATE_NAME);
        tooltip
          .select("#tooltip-content")
          .text(
            `${selectedData}: ${d.properties?.value
              .toString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
          );
        const el = d3.select(event.target);
        el.style("fill", color(max));
      })
      .on("mouseleave", (event, d) => {
        const el = d3.select(event.target);
        el.style("fill", color(d?.properties?.value));
        tooltip.style("visibility", "hidden");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", (event.clientY - 10).toString() + "px")
          .style("left", (event.clientX + 10).toString() + "px");
      });
  };

  // set progress
  let interval = null;

  const startInterval = () => {
    interval = setInterval(() => {
      scrollProgress += 0.001;
      const index = Math.round(scrollProgress * (dates.length - 1));
      date = dates[index > dates.length - 1 ? dates.length - 1 : index];
      if (index < dates.length) {
        d3.select("#map-date-slider").property("value", scrollProgress * 100);
        dateSelector.text(date);
        drawGraph();
      } else {
        clearInterval(interval);
      }
    }, 10);
  };

  startInterval();

  const stopInterval = () => {
    clearInterval(interval);
  };

  d3.select("#map-date-slider").on("input", (e) => {
    stopInterval();
    scrollProgress = e.target.value / 100;
    const index = Math.round(scrollProgress * (dates.length - 1));
    date = dates[index > dates.length - 1 ? dates.length - 1 : index];
    dateSelector.text(date);
    drawGraph();
  });

  d3.select("#start-map-interval").on("click", (e) => {
    if (!interval) startInterval();
  });

  d3.select("#stop-map-interval").on("click", (e) => {
    stopInterval();
  });

  d3.select("#map-var-select").on("change", (e) => {
    selectedData = e.target.value;
    drawGraph();
  });

  drawGraph();

  return drawGraph;
};

const initBarChart = async () => {
  /** Create caption */
  d3.select("#bar-chart")
    .append("h3")
    .attr("class", "mb-5")
    .text("Australia Health Expenditures and Financing between 2015-2022");

  /** Initialize dataset */
  const dataset = await d3.csv(
    "assets/OECD_health_expenditure_and_financing.csv",
    (d) => {
      return {
        year: d.TIME_PERIOD,
        value: +d.OBS_VALUE,
      };
    }
  );

  const drawGraph = () => {
    const width = document.getElementById("bar-chart").offsetWidth;
    const height = (width / 4) * 3;
    const margin = 20;
    const padding = width * 0.01;

    d3.select("#bar-chart").selectAll("svg").remove();

    /** Create SVG DOM object */
    let svg = d3
      .select("#bar-chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    /** Calculate width & height with margin */
    const innerWidth = width - margin * 2;
    const innerHeight = height - margin * 2;
    d3.select("#map").selectAll("svg").remove();
    /** Reinitialize x scale */
    /** Initialize x/y scales */
    let xScale = d3
      .scaleBand()
      .domain(
        d3.range(
          d3.min(dataset, (d) => +d.year),
          d3.max(dataset, (d) => +d.year) + 1
        )
      )
      .range([0, innerWidth]);

    let yScale = d3.scaleLinear().domain([13, 0]).range([0, innerHeight]);

    /** Draw axis */
    const xAxis = d3.axisBottom().ticks(10).scale(xScale);
    const yAxis = d3.axisBottom().ticks(10).scale(yScale);

    svg
      .append("g")
      .attr("transform", `translate(${margin}, ${height - margin})`)
      .attr("class", "font-light text-xs text-gray-500")
      .call(xAxis);
    svg
      .append("g")
      .attr("transform", `rotate(90) translate(${margin}, ${-margin})`) // -1px adjust for line width
      .attr("class", "font-light text-xs text-gray-500")
      .call(yAxis);

    const data = svg.selectAll("rect").data(dataset);

    data
      .enter()
      .append("rect")
      .attr("fill", defaultColorScheme[5][2])
      .on("mouseover", (event, d) => {
        tooltip.style("visibility", "visible");
        tooltip.select("#tooltip-title").text("Year: " + d.year);
        tooltip
          .select("#tooltip-content")
          .text("Percentage of GDP: " + d.value.toFixed(2) + "%");
      })
      .on("mouseleave", (event) => {
        const el = d3.select(event.target);
        tooltip.style("visibility", "hidden");
      })
      .on("mousemove", (event) => {
        tooltip
          .style("top", (event.clientY - 10).toString() + "px")
          .style("left", (event.clientX + 10).toString() + "px");
      })
      .attr("x", (_, index) => index * xScale.bandwidth() + padding + margin)
      .attr("y", (data) => innerHeight - yScale(13 - data.value) + margin)
      .attr("width", xScale.bandwidth() - padding)
      .attr("height", (data) => yScale(13 - data.value));
  };

  return drawGraph;
};

const initLineChart = async () => {
  function getDateOfWeek(w, y) {
    var d = 1 + (w - 1) * 7; // 1st of January + 7 days for each week
    return new Date(y, 0, d);
  }

  /** Load data */
  const dataset_covid = await d3.csv(
    "assets/OECD_au_covid_mortality_by_week.csv",
    (d) => {
      const splits = d.TIME_PERIOD.split("-");
      const year = splits[0];
      const week = +splits[1].replace("W", "");
      return {
        date: getDateOfWeek(week, year),
        number: +d.OBS_VALUE,
        label: d.TIME_PERIOD,
      };
    }
  );

  const dataset_total = await d3.csv(
    "assets/OECD_au_mortality_by_week.csv",
    (d) => {
      const splits = d.TIME_PERIOD.split("-");
      const year = splits[0];
      const week = +splits[1].replace("W", "");
      return {
        date: getDateOfWeek(week, year),
        number: +d.OBS_VALUE,
        label: d.TIME_PERIOD,
      };
    }
  );

  /** Create caption */
  d3.select("#line-chart")
    .append("h3")
    .attr("class", "mb-5")
    .text("Mortality by week in Australia");

  const drawGraph = () => {
    /** Graph configs */
    const width = document.getElementById("line-chart").offsetWidth;
    const height = (width / 4) * 3;
    const paddingX = 20;
    const paddingY = 2;
    const ticksX = 8;
    const ticksY = 7;

    /** Initialize x/y scales */
    const xScale = d3
      .scaleTime()
      .domain([
        d3.min(dataset_covid, (d) => d.date),
        d3.max(dataset_covid, (d) => d.date),
      ])
      .range([paddingX, width - paddingX]);

    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(dataset_total, (d) => d.number),
        // 0,
        d3.max(dataset_total, (d) => d.number),
      ])
      .range([height - paddingY, 0]);

    const area = d3
      .area()
      .x((d) => xScale(d.date))
      .y0(yScale(0))
      .y1((d) => yScale(d.number))
      .curve(d3.curveBasis); // Apply a smoothing curve;

    d3.select("#line-chart").selectAll("svg").remove();
    /** Create SVG DOM object */
    let svg = d3
      .select("#line-chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    svg.selectAll("g").remove();
    svg = svg.append("g");
    /** Draw axis */
    const xAxis = d3.axisBottom().ticks(ticksX).scale(xScale);
    const yAxis = d3.axisBottom().ticks(ticksY).scale(yScale);

    svg
      .append("g")
      .attr("transform", `translate(0, ${yScale(0)})`)
      .attr("class", "font-light text-xs text-gray-500")
      .call(xAxis);
    svg
      .append("g")
      .attr("transform", `rotate(90) translate(0, ${-paddingX})`) // -1px adjust for line width
      .attr("class", "font-light text-xs text-gray-500")
      .call(yAxis);

    const lg = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "gradient")
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    lg.append("stop")
      .attr("offset", "100%")
      .style("stop-color", defaultColorScheme[9][6])
      .style("stop-opacity", 0.5);

    lg.append("stop")
      .attr("offset", "100%")
      .style("stop-color", defaultColorScheme[9][6])
      .style("stop-opacity", 0);

    const lg2 = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "gradient2")
      .attr("x1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    lg2
      .append("stop")
      .attr("offset", "100%")
      .style("stop-color", defaultSecondaryColorScheme[9][6])
      .style("stop-opacity", 0.8);

    lg2
      .append("stop")
      .attr("offset", "100%")
      .style("stop-color", defaultSecondaryColorScheme[9][6])
      .style("stop-opacity", 0);

    svg
      .append("path")
      .datum(dataset_total)
      // .attr("transform", `translate(0, ${-paddingY})`)
      .style("fill", "url(#gradient)") //id of the gradient for fill
      .attr("shape-rendering", "geometricPrecision")
      .attr("d", area);

    svg
      .append("path")
      .datum(dataset_covid)
      // .attr("transform", `translate(0, ${-paddingY})`)
      .style("fill", "url(#gradient2)") //id of the gradient for fill
      .attr("shape-rendering", "geometricPrecision")
      .attr("d", area);

    svg.append("line").attr("id", "hoverLine");
    svg.append("circle").attr("id", "hoverPoint");
    svg.append("circle").attr("id", "hoverPointTotal");
    svg.append("text").attr("id", "hoverText");
    svg.append("text").attr("id", "hoverTextTotal");

    const mouseMove = (event) => {
      const { offsetX, y } = event;

      if (offsetX > width - paddingX || offsetX < paddingX) {
        return;
      }

      const mouseDate = xScale.invert(offsetX);
      const mouseDateSnap = d3.timeWeek.round(mouseDate);

      const bisectDate = d3.bisector((d) => d.date).right;
      const xIndex = bisectDate(dataset_covid, mouseDateSnap, 1);
      const xIndex2 = bisectDate(dataset_total, mouseDateSnap, 1);

      const covid = dataset_covid[xIndex];
      const total = dataset_total[xIndex2];

      console.log(covid, total);
      if (!(covid && total)) return;
      svg
        .selectAll("#hoverLine")
        .attr("x1", xScale(mouseDateSnap))
        .attr("y1", 0)
        .attr("x2", xScale(mouseDateSnap))
        .attr("y2", height - paddingY)
        .attr("stroke", "black")
        .style("stroke-width", 0.75)
        .style("stroke-dasharray", "5,5");

      svg
        .selectAll("#hoverPoint")
        .attr("cx", xScale(mouseDateSnap))
        .attr("cy", yScale(covid.number))
        .attr("r", "4")
        .attr("fill", "black");
      svg
        .selectAll("#hoverPointTotal")
        .attr("cx", xScale(mouseDateSnap))
        .attr("cy", yScale(total.number))
        .attr("r", "4")
        .attr("fill", "black");

      const isLessThanHalf = xIndex > dataset_covid.length / 2;
      const hoverTextX = isLessThanHalf ? "-0.75em" : "0.75em";
      const hoverTextAnchor = isLessThanHalf ? "end" : "start";

      svg
        .selectAll("#hoverText")
        .attr("x", xScale(mouseDateSnap))
        .attr("y", yScale(covid.number))
        .attr("dx", hoverTextX)
        .attr("dy", "-1.25em")
        .style("text-anchor", hoverTextAnchor)
        .attr("class", "text-sm font-light text-gray-500")
        .text(`COVID Deaths: ${covid.number}`);

      svg
        .selectAll("#hoverTextTotal")
        .attr("x", xScale(mouseDateSnap))
        .attr("y", yScale(total.number))
        .attr("dx", hoverTextX)
        .attr("dy", "-1.25em")
        .style("text-anchor", hoverTextAnchor)
        .attr("class", "text-sm font-light text-gray-500")
        .text(`Total Deaths: ${Math.floor(total.number)}`);
    };

    d3.select("#line-chart")
      .selectAll("svg")
      .on("mouseover", mouseMove)
      .on("mousemove", mouseMove);
  };

  return drawGraph;
};

const initGraphs = async () => {
  const drawTimeSeries = await initTimeSeriesGraph();
  const drawBarChart = await initBarChart();
  const drawLineChart = await initLineChart();

  return [drawTimeSeries, drawBarChart, drawLineChart];
};

const initDashboardOptions = (drawGraphFunctions) => {
  const drawRegisteredGraphs = () => {
    for (const drawGraph of drawGraphFunctions) {
      drawGraph();
    }
  };
  const primaryColorSchemeOptions = [
    {},
    {
      name: "Orange",
      value: d3.schemeOranges,
    },
    {
      name: "Blue",
      value: d3.schemeBlues,
    },
    {
      name: "Red",
      value: d3.schemeReds,
    },
    {
      name: "Green",
      value: d3.schemeGreens,
    },
    {
      name: "Purple",
      value: d3.schemePurples,
    },
    {
      name: "Spectral",
      value: d3.schemeSpectral,
    },
  ];

  const secondaryColorSchemeOptions = [
    {},
    {
      name: "Orange",
      value: d3.schemeOranges,
    },
    {
      name: "Blue",
      value: d3.schemeBlues,
    },
    {
      name: "Red",
      value: d3.schemeReds,
    },
    {
      name: "Green",
      value: d3.schemeGreens,
    },
    {
      name: "Purple",
      value: d3.schemePurples,
    },
    {
      name: "Spectral",
      value: d3.schemeSpectral,
    },
  ];

  d3.select("#primary-color-scheme-select").attr(
    "value",
    primaryColorSchemeOptions[1].name
  );

  d3.select("#secondary-color-scheme-select").attr(
    "value",
    secondaryColorSchemeOptions[1].name
  );

  d3.select("#primary-color-scheme-select")
    .selectAll("option")
    .data(primaryColorSchemeOptions)
    .enter()
    .append("option")
    .attr("value", (d) => d.name)
    .text((d) => d.name)
    .classed("text-gray-500");

  d3.select("#secondary-color-scheme-select")
    .selectAll("option")
    .data(secondaryColorSchemeOptions)
    .enter()
    .append("option")
    .attr("value", (d) => d.name)
    .text((d) => d.name)
    .classed("text-gray-500");

  d3.select("#primary-color-scheme-select").on("change", (e) => {
    const matchColorScheme = primaryColorSchemeOptions.find(
      (d) => d.name === e.target.value
    ).value;
    if (matchColorScheme) defaultColorScheme = matchColorScheme;
    drawRegisteredGraphs();
  });

  d3.select("#secondary-color-scheme-select").on("change", (e) => {
    const matchColorScheme = secondaryColorSchemeOptions.find(
      (d) => d.name === e.target.value
    ).value;
    if (matchColorScheme) defaultSecondaryColorScheme = matchColorScheme;
    drawRegisteredGraphs();
  });

  addEventListener("resize", (event) => {
    drawRegisteredGraphs();
  });

  drawRegisteredGraphs();
};

const initFormDropdown = () => {
  d3.select("#form-dropdown-open").classed("hidden", true);

  d3.select("#form-dropdown-close").on("click", (e) => {
    d3.select("#form-dropdown").classed("hidden", true);
    d3.select("#form-dropdown-open").classed("hidden", false);
  });

  d3.select("#form-dropdown-open").on("click", (e) => {
    d3.select("#form-dropdown").classed("hidden", false);
    d3.select("#form-dropdown-open").classed("hidden", true);
  });
};

const graphs = await initGraphs();
initDashboardOptions(graphs);
initFormDropdown();
