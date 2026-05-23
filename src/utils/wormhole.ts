export interface LocationData {
  /** Location name or identifier */
  name: string;
  /** Sea-level pressure from the weather API (in hPa / millibars) */
  P_msl: number;
  /** Temperature (in Celsius) */
  T_c: number;
  /** Altitude / Elevation (in meters) */
  z: number;
}

export interface WormholeResult {
  /** The calculated wind speed through the wormhole */
  windSpeed: number;
  /** Description of the flow direction */
  flowDirection: string;
  /** True if the wind speed reached the speed of sound and is choked */
  isChokedFlow: boolean;
}

/**
 * Calculates the wind speed through a hypothetical 0-meter-long wormhole
 * between two locations based on pressure difference.
 * 
 * @param locA - Data for the first location
 * @param locB - Data for the second location
 * @param unit - The desired output unit for wind speed ('m/s', 'km/h', or 'mph')
 * @returns An object containing the wind speed, flow direction, and choked flow status
 */
export function calculateWormholeWindSpeed(
  locA: LocationData,
  locB: LocationData,
  unit: 'm/s' | 'km/h' | 'mph' = 'm/s',
  lang: 'es' | 'en' = 'es'
): WormholeResult {
  // 2. Unit Conversions (Crucial Step)
  const t_k_A = locA.T_c + 273.15;
  const t_k_B = locB.T_c + 273.15;

  const p_msl_pa_A = locA.P_msl * 100;
  const p_msl_pa_B = locB.P_msl * 100;

  // 3. Calculate Absolute Station Pressure (The Physics of Height)
  const p_abs_A = p_msl_pa_A * Math.pow(1 - (0.0065 * locA.z) / t_k_A, 5.255);
  const p_abs_B = p_msl_pa_B * Math.pow(1 - (0.0065 * locB.z) / t_k_B, 5.255);

  // 4. Determine Flow Direction & Source Variables
  let P_high: number, P_low: number, T_source: number;
  let flowDirection: string;

  if (p_abs_A > p_abs_B) {
    P_high = p_abs_A;
    P_low = p_abs_B;
    T_source = t_k_A;
    flowDirection = lang === 'es' ? `De ${locA.name} a ${locB.name}` : `From ${locA.name} to ${locB.name}`;
  } else if (p_abs_B > p_abs_A) {
    P_high = p_abs_B;
    P_low = p_abs_A;
    T_source = t_k_B;
    flowDirection = lang === 'es' ? `De ${locB.name} a ${locA.name}` : `From ${locB.name} to ${locA.name}`;
  } else {
    // Pressures are exactly equal
    return {
      windSpeed: 0,
      flowDirection: lang === 'es' ? "Sin flujo (Equilibrio de Presión)" : "No flow (Pressure Equilibrium)",
      isChokedFlow: false,
    };
  }

  // 5. Calculate Air Density at the Source
  const R = 287.05; // Specific gas constant for dry air in J/(kg·K)
  const rho = P_high / (R * T_source);

  // 6. Calculate Wind Speed (Bernoulli's Principle)
  let v = Math.sqrt((2 * (P_high - P_low)) / rho);

  // 7. Edge Case: Choked Flow (The Speed of Sound Limit)
  const gamma = 1.4; // Heat capacity ratio for air
  const v_sound = Math.sqrt(gamma * R * T_source);
  
  let isChokedFlow = false;
  if (v > v_sound) {
    v = v_sound;
    isChokedFlow = true;
  }

  // 8. Output Unit Conversion
  let finalSpeed = v;
  if (unit === 'km/h') {
    finalSpeed = v * 3.6;
  } else if (unit === 'mph') {
    finalSpeed = v * 2.237;
  }

  return {
    windSpeed: finalSpeed,
    flowDirection,
    isChokedFlow,
  };
}

/**
 * Generates a dynamic explanation for the wormhole wind speed.
 * 
 * @param speed - The wind speed in km/h
 * @param locA - Data for the first location
 * @param locB - Data for the second location
 * @param lang - The current selected language ('es' or 'en')
 * @returns A string explaining the wind intensity and its physical cause
 */
export function generateWormholeExplanation(
  speed: number,
  locA: LocationData,
  locB: LocationData,
  lang: 'es' | 'en' = 'es'
): string {
  // 1. Calcular Variables de Contexto:
  const deltaAlt = Math.abs(locA.z - locB.z);
  const deltaPmsl = Math.abs(locA.P_msl - locB.P_msl);

  // Para determinar de dónde sale el viento (mayor presión absoluta)
  const t_k_A = locA.T_c + 273.15;
  const t_k_B = locB.T_c + 273.15;
  const p_msl_pa_A = locA.P_msl * 100;
  const p_msl_pa_B = locB.P_msl * 100;
  const p_abs_A = p_msl_pa_A * Math.pow(1 - (0.0065 * locA.z) / t_k_A, 5.255);
  const p_abs_B = p_msl_pa_B * Math.pow(1 - (0.0065 * locB.z) / t_k_B, 5.255);

  const sourceCity = p_abs_A >= p_abs_B ? locA.name : locB.name;
  const destCity = p_abs_A < p_abs_B ? locA.name : locB.name;

  const z_source = sourceCity === locA.name ? locA.z : locB.z;
  const z_dest = destCity === locA.name ? locA.z : locB.z;

  let flowDirection: "cuesta arriba" | "cuesta abajo" | "plano" = "plano";
  if (deltaAlt >= 30) {
    flowDirection = z_source < z_dest ? "cuesta arriba" : "cuesta abajo";
  }

  // 2. Parte 1: Prefijo de Intensidad (switch simple basado solo en velocidad)
  let intensity = "";
  if (lang === 'en') {
    if (speed < 50) {
      intensity = "Barely a breeze (0-50 km/h).";
    } else if (speed < 100) {
      intensity = "Strong wind, hold on tight (50-100 km/h).";
    } else if (speed < 150) {
      intensity = "Hurricane-force wind (100-150 km/h).";
    } else if (speed < 220) {
      intensity = "Extreme destructive winds (150-220 km/h).";
    } else {
      intensity = "Catastrophic force, almost supersonic (>220 km/h).";
    }
  } else {
    if (speed < 50) {
      intensity = "Apenas una brisa (0-50 km/h).";
    } else if (speed < 100) {
      intensity = "Viento fuerte, agárrate bien (50-100 km/h).";
    } else if (speed < 150) {
      intensity = "Viento huracanado (100-150 km/h).";
    } else if (speed < 220) {
      intensity = "Vientos extremos destructivos (150-220 km/h).";
    } else {
      intensity = "Fuerza catastrófica, casi supersónica (>220 km/h).";
    }
  }

  // 3. Parte 2: El Motor Principal (Determinar qué fuerza empuja más)
  let engine = "";
  if (lang === 'en') {
    if (deltaAlt > 100 && deltaPmsl <= 8) {
      // Condición A (Mucha Altitud, Clima normal)
      engine = "Gravity is the protagonist. The heavier atmosphere from the lower area is bursting towards the higher city to try to equalize the weight.";
    } else if (deltaAlt <= 100 && deltaPmsl > 8) {
      // Condición B (Clima extremo, Altitud similar)
      engine = `Topography barely influences here. It is all due to a brutal meteorological clash: the powerful high-pressure system from ${sourceCity} is violently pushing air towards the storm in ${destCity}.`;
    } else if (deltaAlt > 100 && deltaPmsl > 8) {
      // Condición C (La Alianza - Altitud + Clima juntos)
      engine = "Weather and gravity have allied against you. On top of the large elevation difference, there is a massive meteorological pressure gradient.";
    } else {
      // Condición D (Por defecto / Térmico)
      engine = "Barometric and altitude conditions are very similar, generating a simple adjustment current due to thermal differences.";
    }
  } else {
    if (deltaAlt > 100 && deltaPmsl <= 8) {
      // Condición A (Mucha Altitud, Clima normal)
      engine = "La gravedad es la protagonista. La atmósfera más pesada de la zona baja está irrumpiendo hacia la ciudad más alta para intentar igualar el peso.";
    } else if (deltaAlt <= 100 && deltaPmsl > 8) {
      // Condición B (Clima extremo, Altitud similar)
      engine = `La topografía apenas influye aquí. Todo es culpa de un brutal choque meteorológico: el potente sistema de altas presiones de ${sourceCity} está empujando el aire violentamente hacia la borrasca de ${destCity}.`;
    } else if (deltaAlt > 100 && deltaPmsl > 8) {
      // Condición C (La Alianza - Altitud + Clima juntos)
      engine = "El clima y la gravedad se han aliado en tu contra. A la gran diferencia de elevación se le suma un enorme desnivel de presión meteorológica.";
    } else {
      // Condición D (Por defecto / Térmico)
      engine = "Las condiciones barométricas y de altitud son muy similares, generando una simple corriente de ajuste por diferencias térmicas.";
    }
  }

  // 4. Parte 3: El Giro Especial / Modificador (Añadir solo si ocurre algo raro)
  let twist = "";
  if (lang === 'en') {
    if (flowDirection === "cuesta arriba") {
      // Giro 1 (Anti-Gravedad)
      twist = "Watch out for this! Climate pressure is so intense today that it is defying physics, forcing the wind to flow 'uphill' towards the lower zone.";
    } else if (deltaAlt > 250 && speed < 80) {
      // Giro 2 (El Freno Meteorológico)
      twist = `It's almost a miracle: normally this altitude difference would create a hurricane, but a low-pressure system (storm) in ${sourceCity} is acting as a brake, saving your life.`;
    } else if (deltaAlt > 100 && speed < 15) {
      // Giro 3 (El Milagro Perfecto)
      twist = "Planetary alignment! Despite the altitude difference, today's weather has balanced the absolute pressure to the millimeter. You can cross the portal without messing up your hair.";
    }
  } else {
    if (flowDirection === "cuesta arriba") {
      // Giro 1 (Anti-Gravedad)
      twist = "¡Ojo a esto! La presión climática es tan bestia hoy que está desafiando a la física, obligando al viento a fluir 'cuesta arriba' hacia la zona más baja.";
    } else if (deltaAlt > 250 && speed < 80) {
      // Giro 2 (El Freno Meteorológico)
      twist = `Es casi un milagro: normalmente esta diferencia de altitud crearía un huracán, pero un sistema de bajas presiones (borrasca) en ${sourceCity} está actuando como freno, salvándote la vida.`;
    } else if (deltaAlt > 100 && speed < 15) {
      // Giro 3 (El Milagro Perfecto)
      twist = "¡Alineación planetaria! A pesar de la diferencia de altitud, el clima de hoy ha equilibrado la presión absoluta al milímetro. Puedes cruzar el portal sin despeinarte.";
    }
  }

  // 5. Retorno de la función
  let combined = `${intensity} ${engine}`;
  if (twist) {
    combined += ` ${twist}`;
  }

  // Limpiar espacios dobles o bordes y combinar con el detalle de altitudes
  const cleanMessage = combined.trim().replace(/\s+/g, ' ');

  const altitudeDetail = lang === 'es'
    ? ` (${locA.name}, que está a ${Math.round(locA.z)} metros, y ${locB.name}, que está a ${Math.round(locB.z)} metros).`
    : ` (${locA.name}, which is at ${Math.round(locA.z)} meters, and ${locB.name}, which is at ${Math.round(locB.z)} meters).`;

  return `${cleanMessage}${altitudeDetail}`;
}
