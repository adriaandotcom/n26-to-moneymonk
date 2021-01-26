const downloadElement = document.getElementById("download");
const checkboxElement = document.getElementById("header");
const inputElement = document.getElementById("file");
const ibanElement = document.getElementById("iban");

const ibanSaved = window.localStorage.getItem("n26iban");
if (ibanSaved) ibanElement.value = ibanSaved;

async function digestMessage(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.prototype.map
    .call(new Uint8Array(buffer), (x) => ("00" + x.toString(16)).slice(-2))
    .join("");
}

inputElement.addEventListener("change", handleFiles, false);

function handleFiles() {
  const file = this.files[0];

  const iban = ibanElement.value
    ? ibanElement.value.trim().replace(/[^a-zA-Z0-9]+/, "")
    : null;

  if (!iban) {
    alert("No N26 IBAN filled in");
    return;
  }

  window.localStorage.setItem("n26iban", iban);

  async function convertCSV(results) {
    let columns = 0;

    const json = await Promise.all(
      results.data.map(async (row) => {
        const amount = parseFloat(row["Amount (EUR)"]);
        const hash = await digestMessage(JSON.stringify(row));
        const reference = `C0${hash.slice(0, 14)}`.toUpperCase();
        const date = row["Date"].split("-").reverse().join("-");
        const object = {
          Rekeningnummer: iban,
          Transactiedatum: date,
          Valutacode: "EUR",
          CreditDebet: amount >= 0 ? "D" : "C",
          Bedrag: amount >= 0 ? amount : amount * -1,
          Tegenrekeningnummer: row["Account number"],
          Tegenrekeninghouder: row["Payee"],
          Valutadatum: date,
          Betaalwijze: row["Transaction type"],
          Omschrijving: row["Payment reference"],
          "Type betaling": row["Transaction type"],
          Machtigingsnummer: null,
          "Incassant ID": null,
          Adres: null,
          Referentie: reference,
          Boekdatum: date,

          // The last column should be empty
          "": null,
        };
        columns = Object.keys(object).length;
        return object;
      })
    );

    const csvData = Papa.unparse(json, {
      header: true,
      skipEmptyLines: true,
    });

    const commas = Array(columns - 1)
      .fill(",")
      .join("");
    const fileName = `${new Date().toISOString().slice(0, 10)}-knab-export.csv`;
    const fileContent = `KNAB EXPORT${commas}\r\n${csvData}`;

    const csv = new Blob([fileContent], { type: "text/csv" });
    const data = window.URL.createObjectURL(csv);
    downloadElement.setAttribute("href", data);
    downloadElement.setAttribute("download", fileName);
    downloadElement.style.display = "block";
  }

  Papa.parse(file, {
    header: checkboxElement.value === "on",
    skipEmptyLines: true,
    complete: convertCSV,
  });
}
