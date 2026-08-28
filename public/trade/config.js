window.YAAVS_TRADE_CONFIG = {
  submitUrl: "/api/trade/submit",
  responsesUrl: "/api/trade/responses",
  exportUrl: "/api/trade/export.xlsx",
  title: "Encuesta Trade Marketing · Punto de Venta YAAVS",
};

window.YAAVS_TRADE_OPTIONS = {
  productos: [
    "Chips multimarca",
    "Portabilidades",
    "eSIM",
    "Liberaciones",
    "Internet inalámbrico",
    "Tiempo aire",
    "Planes de renta",
  ],
  carrierVolumen: ["Telcel", "AT&T", "Movistar", "BAIT", "Otro"],
  atencion: [
    { value: "1", label: "Pésima" },
    { value: "2", label: "Mala" },
    { value: "3", label: "Regular" },
    { value: "4", label: "Buena" },
    { value: "5", label: "Excelente" },
  ],
  frecuencia: [
    "Dos o más veces por semana",
    "Una vez por semana",
    "Una vez cada 15 días",
    "No me visitan",
  ],
  materialPop: [
    "Lona",
    "Stopper",
    "Chipcera",
    "Activación BTL",
    "Vinil",
    "Electrostático",
    "Otro",
  ],
  satisfaccionGeneral: [
    { value: "1", label: "Muy insatisfecho(a)" },
    { value: "2", label: "Insatisfecho(a)" },
    { value: "3", label: "Neutral" },
    { value: "4", label: "Satisfecho(a)" },
    { value: "5", label: "Muy satisfecho(a)" },
  ],
  sigueRedes: ["Sí", "No"],
  redesSociales: ["Instagram", "Facebook", "TikTok"],
  otroDistribuidor: ["Sí", "No"],
};
