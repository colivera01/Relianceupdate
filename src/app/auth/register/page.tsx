'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TutorialEntryPoint } from '@/components/guidance/TutorialEntryPoint';
import {
  buildSelectedTemplateServices,
  createInitialRegisterFormData,
  getRegisterFormDataForRoleSwitch,
  getTemplateServiceDefaultDetail,
  type TemplateServiceDetailDraft,
} from '@/lib/register-flow';
import {
  appendAuthNext,
  getAuthEntryBackHref,
  getAuthEntryBackLabel,
  getAuthEntryDescription,
  sanitizeAuthNextPath,
} from '@/lib/auth-next';
import { tutorialGuides } from '@/lib/user-guidance';
import {
  User, 
  Shield, 
  ArrowLeft, 
  CheckCircle, 
  Mail, 
  Lock, 
  User as UserIcon,
  Building,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  AlertCircle,
  Info,
  X
} from 'lucide-react';
import { getServiceTemplatesForCategory } from '@/config/service-templates';

// reCAPTCHA Configuration - Update this single location if site key changes
const RECAPTCHA_SITE_KEY = '6LdAapYrAAAAAACfyJlrW40cSZBS7mm_W8r3Mjkiw';

// US States list for dropdown selection
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

// Cities organized by state
const CITIES_BY_STATE: { [key: string]: string[] } = {
  'Alabama': [
    'Abbeville', 'Adamsville', 'Alabaster', 'Albertville', 'Alexander City', 'Andalusia', 'Anniston', 'Arab', 'Ashford', 'Ashland',
    'Athens', 'Atmore', 'Auburn', 'Bay Minette', 'Bayou La Batre', 'Bear Creek', 'Bessemer', 'Birmingham', 'Boaz', 'Brewton',
    'Bridgeport', 'Brighton', 'Brilliant', 'Brookside', 'Brundidge', 'Butler', 'Calera', 'Camden', 'Carbon Hill', 'Center Point',
    'Centre', 'Centreville', 'Chickasaw', 'Childersburg', 'Citronelle', 'Clay', 'Clio', 'Coaling', 'Coffeeville', 'Cordova',
    'Cottonwood', 'Cullman', 'Dadeville', 'Daleville', 'Decatur', 'Demopolis', 'Dothan', 'Double Springs', 'East Brewton', 'Enterprise',
    'Eufaula', 'Eutaw', 'Evergreen', 'Fairhope', 'Fairview', 'Florence', 'Foley', 'Fort Payne', 'Frisco City', 'Fultondale',
    'Gadsden', 'Gardendale', 'Geneva', 'Goodwater', 'Gordo', 'Gulf Shores', 'Guntersville', 'Hamilton', 'Hanceville', 'Headland',
    'Heath', 'Homewood', 'Hoover', 'Huntsville', 'Jacksonville', 'Jasper', 'Leeds', 'Lincoln', 'Linden', 'Lineville',
    'Livingston', 'Luverne', 'Madison', 'Mobile', 'Montgomery', 'Muscle Shoals', 'Northport', 'Oneonta', 'Opelika', 'Opp',
    'Orange Beach', 'Ozark', 'Pell City', 'Phenix City', 'Pike Road', 'Pine Hill', 'Pine Ridge', 'Prattville', 'Prichard', 'Rainsville',
    'Roanoke', 'Russellville', 'Samson', 'Saraland', 'Sardis', 'Scottsboro', 'Selma', 'Sheffield', 'Sylacauga', 'Sylvan Springs',
    'Talladega', 'Troy', 'Trussville', 'Tuscaloosa', 'Tuscumbia', 'Tuskegee', 'Valley', 'Vestavia Hills', 'Wetumpka'
  ],
  'Alaska': [
    'Adak', 'Akhiok', 'Akiachak', 'Akiak', 'Akutan', 'Alakanuk', 'Aleknagik', 'Allakaket', 'Ambler', 'Anaktuvuk Pass',
    'Anchorage', 'Anderson', 'Angoon', 'Aniak', 'Anvik', 'Atka', 'Atqasuk', 'Barrow', 'Bethel', 'Bettles',
    'Brevig Mission', 'Buckland', 'Central', 'Chefornak', 'Chevak', 'Chignik', 'Chignik Lagoon', 'Chignik Lake', 'Chitina', 'Circle',
    'Clark\'s Point', 'Coffman Cove', 'Cold Bay', 'Cooper Landing', 'Cordova', 'Craig', 'Deering', 'Delta Junction', 'Dillingham', 'Diomede',
    'Eagle', 'Eek', 'Egegik', 'Ekwok', 'Emmonak', 'Fairbanks', 'False Pass', 'Fort Yukon', 'Galena', 'Gambell',
    'Golovin', 'Goodnews Bay', 'Grayling', 'Gustavus', 'Haines', 'Holy Cross', 'Homer', 'Hoonah', 'Hooper Bay', 'Hughes',
    'Huslia', 'Hydaburg', 'Iliamna', 'Kachemak', 'Kake', 'Kaktovik', 'Kaltag', 'Kasaan', 'Kenai', 'Ketchikan',
    'Kiana', 'King Cove', 'King Salmon', 'Kivalina', 'Klawock', 'Kobuk', 'Kodiak', 'Kotlik', 'Kotzebue', 'Koyuk',
    'Koyukuk', 'Kupreanof', 'Kwethluk', 'Larsen Bay', 'Levelock', 'Lime Village', 'Lower Kalskag', 'Manokotak', 'Marshall', 'McGrath',
    'Mekoryuk', 'Mountain Village', 'Napakiak', 'Napaskiak', 'Nenana', 'New Stuyahok', 'Newhalen', 'Newtok', 'Nightmute', 'Nikolai',
    'Nikolski', 'Nome', 'Nondalton', 'Noorvik', 'North Pole', 'Northway', 'Nuiqsut', 'Nulato', 'Nunam Iqua', 'Nunapitchuk',
    'Old Harbor', 'Ouzinkie', 'Palmer', 'Pelican', 'Petersburg', 'Pilot Point', 'Pilot Station', 'Platinum', 'Point Hope', 'Point Lay',
    'Port Alexander', 'Port Heiden', 'Port Lions', 'Quinhagak', 'Ruby', 'Russian Mission', 'St. George', 'St. Mary\'s', 'St. Michael', 'St. Paul',
    'Sand Point', 'Savoonga', 'Saxman', 'Scammon Bay', 'Selawik', 'Seldovia', 'Seward', 'Shageluk', 'Shaktoolik', 'Shishmaref',
    'Shungnak', 'Sitka', 'Skagway', 'Soldotna', 'Stebbins', 'Tanana', 'Teller', 'Tenakee Springs', 'Thorne Bay', 'Togiak',
    'Toksook Bay', 'Unalakleet', 'Unalaska', 'Valdez', 'Wainwright', 'Wales', 'Wasilla', 'White Mountain', 'Whittier', 'Wrangell'
  ],
  'Arizona': [
    'Apache Junction', 'Avondale', 'Benson', 'Bisbee', 'Buckeye', 'Bullhead City', 'Camp Verde', 'Casa Grande', 'Cave Creek', 'Chandler',
    'Chino Valley', 'Clarkdale', 'Clifton', 'Colorado City', 'Coolidge', 'Cottonwood', 'Dewey-Humboldt', 'Douglas', 'Duncan', 'Eagar',
    'El Mirage', 'Eloy', 'Flagstaff', 'Florence', 'Fountain Hills', 'Fredonia', 'Gila Bend', 'Gilbert', 'Glendale', 'Globe',
    'Goodyear', 'Guadalupe', 'Hayden', 'Holbrook', 'Huachuca City', 'Jerome', 'Kearny', 'Kingman', 'Lake Havasu City', 'Litchfield Park',
    'Mammoth', 'Marana', 'Maricopa', 'Mesa', 'Miami', 'Nogales', 'Oro Valley', 'Page', 'Paradise Valley', 'Parker',
    'Patagonia', 'Payson', 'Peoria', 'Phoenix', 'Pima', 'Pinetop-Lakeside', 'Prescott', 'Prescott Valley', 'Quartzsite', 'Queen Creek',
    'Safford', 'Sahuarita', 'San Luis', 'Scottsdale', 'Sedona', 'Show Low', 'Sierra Vista', 'Snowflake', 'Somerton', 'South Tucson',
    'Surprise', 'Taylor', 'Tempe', 'Thatcher', 'Tolleson', 'Tombstone', 'Tucson', 'Wellton', 'Wickenburg', 'Willcox',
    'Williams', 'Winkelman', 'Winslow', 'Youngtown', 'Yuma'
  ],
  'Arkansas': [
    'Alexander', 'Arkadelphia', 'Ashdown', 'Atkins', 'Augusta', 'Austin', 'Bald Knob', 'Barling', 'Batesville', 'Bauxite',
    'Bearden', 'Beaver', 'Bella Vista', 'Benton', 'Bentonville', 'Berryville', 'Bigelow', 'Blytheville', 'Bono', 'Booneville',
    'Brinkley', 'Brookland', 'Bryant', 'Cabot', 'Camden', 'Carlisle', 'Cave City', 'Cedarville', 'Charleston', 'Cherokee Village',
    'Clarendon', 'Clarksville', 'Clinton', 'Conway', 'Corning', 'Cotter', 'Crossett', 'Danville', 'Dardanelle', 'De Queen',
    'Decatur', 'Dermott', 'Des Arc', 'DeWitt', 'Diaz', 'Dover', 'Dumas', 'Earle', 'East End', 'El Dorado',
    'Elkins', 'England', 'Eureka Springs', 'Fairfield Bay', 'Farmington', 'Fayetteville', 'Flippin', 'Fordyce', 'Forrest City', 'Fort Smith',
    'Fouke', 'Gassville', 'Gentry', 'Glenwood', 'Gosnell', 'Gould', 'Gravette', 'Greenbrier', 'Greenwood', 'Gurdon',
    'Hamburg', 'Hampton', 'Harrisburg', 'Harrison', 'Haskell', 'Hazen', 'Heber Springs', 'Helena-West Helena', 'Hermitage', 'Highland',
    'Hope', 'Hot Springs', 'Hot Springs Village', 'Hoxie', 'Hughes', 'Huntsville', 'Jacksonville', 'Jasper', 'Jonesboro', 'Junction City',
    'Lake City', 'Lake Village', 'Lavaca', 'Leachville', 'Lepanto', 'Lewisville', 'Lincoln', 'Little Flock', 'Little Rock', 'Lonoke',
    'Lowell', 'Luxora', 'Madison', 'Magnolia', 'Malvern', 'Mammoth Spring', 'Manila', 'Marianna', 'Marion', 'Marked Tree',
    'Marshall', 'Maumelle', 'McCrory', 'McGehee', 'Melbourne', 'Mena', 'Mineral Springs', 'Monticello', 'Morrilton', 'Mountain Home',
    'Mountain View', 'Mulberry', 'Murfreesboro', 'Nashville', 'Newport', 'North Little Rock', 'Osceola', 'Ozark', 'Paragould', 'Paris',
    'Pea Ridge', 'Perryville', 'Piggott', 'Pine Bluff', 'Pocahontas', 'Pottsville', 'Prairie Grove', 'Prescott', 'Quitman', 'Rector',
    'Rogers', 'Russellville', 'Salem', 'Searcy', 'Sheridan', 'Sherwood', 'Siloam Springs', 'Smackover', 'Springdale', 'Stamps',
    'Star City', 'Stephens', 'Stuttgart', 'Texarkana', 'Trumann', 'Tuckerman', 'Van Buren', 'Vilonia', 'Waldo', 'Waldron',
    'Walnut Ridge', 'Ward', 'Warren', 'Weiner', 'West Fork', 'West Helena', 'West Memphis', 'White Hall', 'Wynne'
  ],
  'California': [
    'Adelanto', 'Agoura Hills', 'Alameda', 'Albany', 'Alhambra', 'Aliso Viejo', 'Alturas', 'Amador City', 'American Canyon', 'Anaheim',
    'Anderson', 'Angels Camp', 'Antioch', 'Apple Valley', 'Arcadia', 'Arcata', 'Arroyo Grande', 'Artesia', 'Arvin', 'Atascadero',
    'Atherton', 'Atwater', 'Auburn', 'Avalon', 'Avenal', 'Azusa', 'Bakersfield', 'Baldwin Park', 'Banning', 'Barstow',
    'Beaumont', 'Bell', 'Bell Gardens', 'Bellflower', 'Belmont', 'Belvedere', 'Benicia', 'Berkeley', 'Beverly Hills', 'Big Bear Lake',
    'Big Sur', 'Bishop', 'Blue Lake', 'Blythe', 'Bradbury', 'Brawley', 'Brea', 'Brentwood', 'Brisbane', 'Buellton',
    'Burbank', 'Burlingame', 'Calabasas', 'Calexico', 'California City', 'Calimesa', 'Calistoga', 'Camarillo', 'Campbell', 'Canyon Lake',
    'Capitola', 'Carlsbad', 'Carmel-by-the-Sea', 'Carpinteria', 'Carson', 'Cathedral City', 'Ceres', 'Cerritos', 'Chico', 'Chino',
    'Chino Hills', 'Chula Vista', 'Citrus Heights', 'Claremont', 'Clayton', 'Clearlake', 'Clovis', 'Coachella', 'Coalinga', 'Colfax',
    'Colton', 'Colusa', 'Commerce', 'Compton', 'Concord', 'Corcoran', 'Corona', 'Coronado', 'Costa Mesa', 'Cotati',
    'Covina', 'Crescent City', 'Cudahy', 'Culver City', 'Cupertino', 'Cypress', 'Daly City', 'Dana Point', 'Danville', 'Davis',
    'Del Mar', 'Del Rey Oaks', 'Delano', 'Desert Hot Springs', 'Diamond Bar', 'Dinuba', 'Dixon', 'Dorris', 'Dos Palos', 'Downey',
    'Duarte', 'Dublin', 'Dunsmuir', 'East Palo Alto', 'El Cajon', 'El Centro', 'El Cerrito', 'El Monte', 'El Segundo', 'Elk Grove',
    'Emeryville', 'Encinitas', 'Escalon', 'Escondido', 'Etna', 'Eureka', 'Exeter', 'Fairfax', 'Fairfield', 'Farmersville',
    'Ferndale', 'Fillmore', 'Firebaugh', 'Folsom', 'Fontana', 'Fort Bragg', 'Fort Jones', 'Fortuna', 'Foster City', 'Fountain Valley',
    'Fowler', 'Fremont', 'Fresno', 'Fullerton', 'Galt', 'Garden Grove', 'Gardena', 'Gilroy', 'Glendale', 'Glendora',
    'Goleta', 'Gonzales', 'Grand Terrace', 'Grass Valley', 'Greenfield', 'Gridley', 'Grover Beach', 'Guadalupe', 'Gustine', 'Half Moon Bay',
    'Hanford', 'Hawaiian Gardens', 'Hawthorne', 'Hayward', 'Healdsburg', 'Hemet', 'Hercules', 'Hermosa Beach', 'Hesperia', 'Hidden Hills',
    'Highland', 'Hollister', 'Holtville', 'Hughson', 'Huntington Beach', 'Huntington Park', 'Huron', 'Imperial', 'Imperial Beach', 'Indian Wells',
    'Indio', 'Industry', 'Inglewood', 'Ione', 'Irvine', 'Irwindale', 'Isleton', 'Jackson', 'Jurupa Valley', 'Kerman',
    'King City', 'Kingsburg', 'La Cañada Flintridge', 'La Habra', 'La Habra Heights', 'La Mesa', 'La Mirada', 'La Palma', 'La Puente', 'La Quinta',
    'La Verne', 'Lafayette', 'Laguna Beach', 'Laguna Hills', 'Laguna Niguel', 'Laguna Woods', 'Lake Elsinore', 'Lake Forest', 'Lakeport', 'Lakewood',
    'Lancaster', 'Larkspur', 'Lathrop', 'Lawndale', 'Lemon Grove', 'Lemoore', 'Lincoln', 'Lindsay', 'Live Oak', 'Livermore',
    'Livingston', 'Lodi', 'Loma Linda', 'Lomita', 'Lompoc', 'Long Beach', 'Loomis', 'Los Alamitos', 'Los Altos', 'Los Altos Hills',
    'Los Angeles', 'Los Banos', 'Los Gatos', 'Loyalton', 'Lynwood', 'Madera', 'Malibu', 'Mammoth Lakes', 'Manhattan Beach', 'Manteca',
    'Maricopa', 'Marina', 'Martinez', 'Marysville', 'McFarland', 'Mendota', 'Menifee', 'Menlo Park', 'Merced', 'Mill Valley',
    'Millbrae', 'Milpitas', 'Mission Viejo', 'Modesto', 'Monrovia', 'Montague', 'Montclair', 'Montebello', 'Monterey', 'Monterey Park',
    'Moorpark', 'Moreno Valley', 'Morgan Hill', 'Morro Bay', 'Mountain View', 'Murrieta', 'Napa', 'National City', 'Needles', 'Nevada City',
    'Newark', 'Newman', 'Newport Beach', 'Norco', 'Norwalk', 'Novato', 'Oakdale', 'Oakland', 'Oakley', 'Oceanside',
    'Ojai', 'Ontario', 'Orange', 'Orange Cove', 'Orinda', 'Orland', 'Oroville', 'Oxnard', 'Pacific Grove', 'Pacifica',
    'Palm Desert', 'Palm Springs', 'Palmdale', 'Palo Alto', 'Palos Verdes Estates', 'Paradise', 'Paramount', 'Parlier', 'Pasadena', 'Paso Robles',
    'Patterson', 'Perris', 'Petaluma', 'Pico Rivera', 'Piedmont', 'Pinole', 'Pismo Beach', 'Pittsburg', 'Placentia', 'Placerville',
    'Pleasant Hill', 'Pleasanton', 'Plymouth', 'Point Arena', 'Pomona', 'Port Hueneme', 'Porterville', 'Portola', 'Portola Valley', 'Poway',
    'Rancho Cordova', 'Rancho Cucamonga', 'Rancho Mirage', 'Rancho Palos Verdes', 'Rancho Santa Margarita', 'Red Bluff', 'Redding', 'Redlands', 'Redondo Beach', 'Redwood City',
    'Reedley', 'Rialto', 'Richmond', 'Ridgecrest', 'Rio Vista', 'Ripon', 'Riverbank', 'Riverside', 'Rocklin', 'Rohnert Park',
    'Rolling Hills', 'Rolling Hills Estates', 'Rosemead', 'Roseville', 'Ross', 'Sacramento', 'Salinas', 'San Anselmo', 'San Bernardino', 'San Bruno',
    'San Carlos', 'San Clemente', 'San Diego', 'San Dimas', 'San Fernando', 'San Francisco', 'San Gabriel', 'San Jacinto', 'San Joaquin', 'San Jose',
    'San Juan Bautista', 'San Juan Capistrano', 'San Leandro', 'San Luis Obispo', 'San Marcos', 'San Marino', 'San Mateo', 'San Pablo', 'San Rafael', 'San Ramon',
    'Sand City', 'Sanger', 'Santa Ana', 'Santa Barbara', 'Santa Clara', 'Santa Clarita', 'Santa Cruz', 'Santa Fe Springs', 'Santa Maria', 'Santa Monica',
    'Santa Paula', 'Santa Rosa', 'Santee', 'Saratoga', 'Sausalito', 'Scotts Valley', 'Seal Beach', 'Seaside', 'Sebastopol', 'Selma',
    'Shafter', 'Shasta Lake', 'Sierra Madre', 'Signal Hill', 'Simi Valley', 'Solana Beach', 'Soledad', 'Solvang', 'Sonoma', 'Sonora',
    'South El Monte', 'South Gate', 'South Lake Tahoe', 'South Pasadena', 'South San Francisco', 'St. Helena', 'Stanton', 'Stockton', 'Suisun City', 'Sunnyvale',
    'Susanville', 'Taft', 'Tehachapi', 'Temecula', 'Temple City', 'Thousand Oaks', 'Tiburon', 'Torrance', 'Tracy', 'Trinidad',
    'Truckee', 'Tulare', 'Tulelake', 'Turlock', 'Tustin', 'Twentynine Palms', 'Ukiah', 'Union City', 'Upland', 'Vacaville',
    'Vallejo', 'Ventura', 'Vernon', 'Victorville', 'Villa Park', 'Visalia', 'Vista', 'Walnut', 'Walnut Creek', 'Wasco',
    'Waterford', 'Watsonville', 'Weed', 'West Covina', 'West Hollywood', 'West Sacramento', 'Westlake Village', 'Westminster', 'Westmorland', 'Wheatland',
    'Whittier', 'Wildomar', 'Williams', 'Willits', 'Willows', 'Windsor', 'Winters', 'Woodlake', 'Woodland', 'Woodside',
    'Yorba Linda', 'Yountville', 'Yreka', 'Yuba City', 'Yucaipa', 'Yucca Valley'
  ],
  'Colorado': [
    'Alamosa', 'Aspen', 'Aurora', 'Avon', 'Basalt', 'Berthoud', 'Boulder', 'Breckenridge', 'Brighton', 'Broomfield',
    'Brush', 'Burlington', 'Canon City', 'Carbondale', 'Castle Rock', 'Centennial', 'Central City', 'Colorado Springs', 'Commerce City', 'Cortez',
    'Craig', 'Creede', 'Crested Butte', 'Cripple Creek', 'Delta', 'Denver', 'Dillon', 'Durango', 'Eagle', 'Edgewater',
    'Elizabeth', 'Englewood', 'Estes Park', 'Evans', 'Federal Heights', 'Firestone', 'Fort Collins', 'Fort Lupton', 'Fort Morgan', 'Fountain',
    'Frisco', 'Fruita', 'Glenwood Springs', 'Golden', 'Grand Junction', 'Greeley', 'Greenwood Village', 'Gunnison', 'Gypsum', 'Idaho Springs',
    'Johnstown', 'La Junta', 'Lafayette', 'Lakewood', 'Lamar', 'Leadville', 'Littleton', 'Longmont', 'Louisville', 'Loveland',
    'Manitou Springs', 'Mead', 'Milliken', 'Monte Vista', 'Montrose', 'Northglenn', 'Ouray', 'Pagosa Springs', 'Palisade', 'Parker',
    'Pueblo', 'Rifle', 'Salida', 'Sanford', 'Sheridan', 'Silverthorne', 'Silverton', 'Snowmass Village', 'Steamboat Springs', 'Sterling',
    'Superior', 'Telluride', 'Thornton', 'Timnath', 'Trinidad', 'Vail', 'Walsenburg', 'Wellington', 'Westminster', 'Wheat Ridge',
    'Windsor', 'Woodland Park'
  ],
  'Connecticut': [
    'Ansonia', 'Avon', 'Berlin', 'Bethel', 'Bloomfield', 'Bolton', 'Branford', 'Bridgeport', 'Bristol', 'Brookfield',
    'Brooklyn', 'Burlington', 'Canaan', 'Canton', 'Chaplin', 'Cheshire', 'Chester', 'Clinton', 'Colchester', 'Colebrook',
    'Columbia', 'Cornwall', 'Coventry', 'Cromwell', 'Danbury', 'Darien', 'Deep River', 'Derby', 'Durham', 'East Granby',
    'East Haddam', 'East Hampton', 'East Hartford', 'East Haven', 'East Lyme', 'East Windsor', 'Eastford', 'Easton', 'Ellington', 'Enfield',
    'Essex', 'Fairfield', 'Farmington', 'Franklin', 'Glastonbury', 'Goshen', 'Granby', 'Greenwich', 'Griswold', 'Groton',
    'Guilford', 'Haddam', 'Hamden', 'Hartford', 'Hartland', 'Harwinton', 'Hebron', 'Kent', 'Killingly', 'Killingworth',
    'Lebanon', 'Ledyard', 'Lisbon', 'Litchfield', 'Lyme', 'Madison', 'Manchester', 'Mansfield', 'Marlborough', 'Meriden',
    'Middlebury', 'Middlefield', 'Middletown', 'Milford', 'Monroe', 'Montville', 'Morris', 'Naugatuck', 'New Britain', 'New Canaan',
    'New Fairfield', 'New Hartford', 'New Haven', 'New London', 'New Milford', 'Newington', 'Newtown', 'Norfolk', 'North Branford', 'North Canaan',
    'North Haven', 'North Stonington', 'Norwalk', 'Norwich', 'Old Lyme', 'Old Saybrook', 'Orange', 'Oxford', 'Plainfield', 'Plainville',
    'Plymouth', 'Pomfret', 'Portland', 'Preston', 'Prospect', 'Putnam', 'Redding', 'Ridgefield', 'Rocky Hill', 'Roxbury',
    'Salem', 'Salisbury', 'Scotland', 'Seymour', 'Sharon', 'Shelton', 'Sherman', 'Simsbury', 'Somers', 'South Windsor',
    'Southbury', 'Southington', 'Sprague', 'Stafford', 'Stamford', 'Sterling', 'Stonington', 'Stratford', 'Suffield', 'Thomaston',
    'Thompson', 'Tolland', 'Torrington', 'Trumbull', 'Union', 'Vernon', 'Voluntown', 'Wallingford', 'Warren', 'Washington',
    'Waterbury', 'Waterford', 'Watertown', 'West Hartford', 'West Haven', 'Westbrook', 'Weston', 'Westport', 'Wethersfield', 'Willington',
    'Wilton', 'Winchester', 'Windham', 'Windsor', 'Windsor Locks', 'Wolcott', 'Woodbridge', 'Woodbury', 'Woodstock'
  ],
  'Delaware': [
    'Arden', 'Ardencroft', 'Ardentown', 'Bellefonte', 'Bethany Beach', 'Bethel', 'Blades', 'Bowers', 'Bridgeville', 'Camden',
    'Cheswold', 'Claymont', 'Clayton', 'Dagsboro', 'Delaware City', 'Delmar', 'Dewey Beach', 'Dover', 'Ellendale', 'Elsmere',
    'Farmington', 'Felton', 'Fenwick Island', 'Frankford', 'Frederica', 'Georgetown', 'Greenwood', 'Harrington', 'Hartly', 'Henlopen Acres',
    'Houston', 'Kent Acres', 'Laurel', 'Lewes', 'Little Creek', 'Magnolia', 'Middletown', 'Milford', 'Millsboro', 'Millville',
    'Milton', 'New Castle', 'Newark', 'Newport', 'Ocean View', 'Odessa', 'Rehoboth Beach', 'Seaford', 'Selbyville', 'Smyrna',
    'South Bethany', 'Slaughter Beach', 'Smyrna', 'Townsend', 'Viola', 'Wilmington', 'Woodside', 'Wyoming'
  ],
  'Florida': [
    'Alachua', 'Alford', 'Altamonte Springs', 'Altha', 'Anna Maria', 'Apalachicola', 'Apopka', 'Arcadia', 'Archer', 'Astatula', 'Atlantic Beach',
    'Auburndale', 'Aventura', 'Avon Park', 'Bal Harbour', 'Bartow', 'Bascom', 'Bay Harbor Islands', 'Bay Pines', 'Bell', 'Belle Glade', 'Belle Isle',
    'Belleair', 'Belleair Beach', 'Belleair Bluffs', 'Belleview', 'Beverly Hills', 'Big Coppitt Key', 'Big Pine Key', 'Blountstown', 'Boca Raton',
    'Bokeelia', 'Bonifay', 'Bonita Springs', 'Bowling Green', 'Boynton Beach', 'Bradenton', 'Bradenton Beach', 'Branford', 'Bristol', 'Bronson',
    'Brooker', 'Brooksville', 'Bunnell', 'Bushnell', 'Callahan', 'Callaway', 'Campbellton', 'Cape Canaveral', 'Cape Coral', 'Carrabelle', 'Caryville',
    'Casselberry', 'Cedar Key', 'Center Hill', 'Century', 'Chattahoochee', 'Chiefland', 'Chipley', 'Choctaw Beach', 'Cinco Bayou', 'Clearwater',
    'Clermont', 'Clewiston', 'Cloud Lake', 'Cocoa', 'Cocoa Beach', 'Coconut Creek', 'Coleman', 'Cooper City', 'Coral Gables', 'Coral Springs',
    'Cottondale', 'Crawfordville', 'Crescent City', 'Crestview', 'Cross City', 'Crystal River', 'Cudjoe Key', 'Cutler Bay', 'Dade City', 'Dania Beach',
    'Davenport', 'Davie', 'Daytona Beach', 'Daytona Beach Shores', 'DeBary', 'Deerfield Beach', 'DeFuniak Springs', 'DeLand', 'Delray Beach', 'Deltona',
    'Destin', 'Doral', 'Dundee', 'Dunedin', 'Dunnellon', 'Eagle Lake', 'Eatonville', 'Edgewater', 'Edgewood', 'El Portal', 'Estero', 'Eustis',
    'Everglades City', 'Fanning Springs', 'Fellsmere', 'Fernandina Beach', 'Flagler Beach', 'Florida City', 'Fort Lauderdale', 'Fort Meade', 'Fort Myers',
    'Fort Myers Beach', 'Fort Pierce', 'Fort Walton Beach', 'Fort White', 'Freeport', 'Frostproof', 'Fruitland Park', 'Gainesville', 'Glen Ridge',
    'Golden Beach', 'Graceville', 'Grand Ridge', 'Greenacres', 'Green Cove Springs', 'Greenville', 'Gretna', 'Groveland', 'Gulf Breeze', 'Gulf Stream',
    'Gulfport', 'Haines City', 'Hallandale Beach', 'Hampton', 'Havana', 'Hialeah', 'Hialeah Gardens', 'Highland Beach', 'Highland Park', 'Highlands',
    'Hillcrest Heights', 'Hilliard', 'Holly Hill', 'Hollywood', 'Holmes Beach', 'Homestead', 'Homosassa', 'Howey-in-the-Hills', 'Hypoluxo', 'Indialantic',
    'Indian Harbour Beach', 'Indian Rocks Beach', 'Indian Shores', 'Inglis', 'Interlachen', 'Inverness', 'Islamorada', 'Jacksonville', 'Jacksonville Beach',
    'Jasper', 'Jay', 'Jensen Beach', 'Juno Beach', 'Jupiter', 'Jupiter Inlet Colony', 'Kenneth City', 'Key Biscayne', 'Key Colony Beach', 'Key Largo',
    'Key West', 'Keystone Heights', 'Kissimmee', 'LaBelle', 'Lakeland', 'Lake Alfred', 'Lake Buena Vista', 'Lake Butler', 'Lake City', 'Lake Clarke Shores',
    'Lake Hamilton', 'Lake Helen', 'Lake Mary', 'Lake Park', 'Lake Placid', 'Lake Wales', 'Lake Worth', 'Lakeland Highlands', 'Lakeside', 'Lakewood Park',
    'Lantana', 'Largo', 'Lauderdale Lakes', 'Lauderdale-by-the-Sea', 'Lauderhill', 'Laurel Hill', 'Lawtey', 'Layton', 'Lazy Lake', 'Leesburg', 'Lighthouse Point',
    'Live Oak', 'Longboat Key', 'Longwood', 'Loxahatchee Groves', 'Lynn Haven', 'Macclenny', 'Madeira Beach', 'Madison', 'Maitland', 'Malabar', 'Malone',
    'Manalapan', 'Mangonia Park', 'Marathon', 'Marco Island', 'Margate', 'Marianna', 'Mascotte', 'Mayo', 'McIntosh', 'Melbourne', 'Melbourne Beach',
    'Melbourne Village', 'Mexico Beach', 'Miami', 'Miami Beach', 'Miami Gardens', 'Miami Lakes', 'Miami Shores', 'Miami Springs', 'Micanopy', 'Midway',
    'Milton', 'Minneola', 'Miramar', 'Monticello', 'Moore Haven', 'Mount Dora', 'Mulberry', 'Naples', 'Neptune Beach', 'New Port Richey', 'New Smyrna Beach',
    'Niceville', 'North Bay Village', 'North Lauderdale', 'North Miami', 'North Miami Beach', 'North Palm Beach', 'North Port', 'North Redington Beach',
    'Oak Hill', 'Oakland', 'Oakland Park', 'Ocala', 'Ocean Ridge', 'Ocoee', 'Okeechobee', 'Oldsmar', 'Opa-locka', 'Orange Beach', 'Orange City',
    'Orange Park', 'Orlando', 'Ormond Beach', 'Osteen', 'Oviedo', 'Pahokee', 'Palatka', 'Palm Bay', 'Palm Beach', 'Palm Beach Gardens', 'Palm Beach Shores',
    'Palm Coast', 'Palm Harbor', 'Palm Shores', 'Palm Springs', 'Palmetto', 'Panacea', 'Panama City', 'Panama City Beach', 'Parker', 'Parkland', 'Pembroke Park',
    'Pembroke Pines', 'Pensacola', 'Pensacola Beach', 'Perdido Key', 'Perry', 'Pinecrest', 'Pinellas Park', 'Plant City', 'Plantation', 'Pompano Beach',
    'Ponce Inlet', 'Ponte Vedra', 'Ponte Vedra Beach', 'Port Charlotte', 'Port Orange', 'Port Richey', 'Port St. Joe', 'Port St. Lucie', 'Punta Gorda',
    'Quincy', 'Raiford', 'Reddick', 'Redington Beach', 'Redington Shores', 'Riviera Beach', 'Rockledge', 'Royal Palm Beach', 'Safety Harbor', 'San Antonio',
    'Sanford', 'Sanibel', 'Satellite Beach', 'Sebastian', 'Sebring', 'Seminole', 'Sewall\'s Point', 'Shalimar', 'Sneads', 'Sopchoppy', 'South Bay',
    'South Daytona', 'South Miami', 'South Palm Beach', 'South Pasadena', 'Springfield', 'St. Augustine', 'St. Augustine Beach', 'St. Cloud', 'St. George Island',
    'St. Leo', 'St. Lucie Village', 'St. Marks', 'St. Pete Beach', 'St. Petersburg', 'Starke', 'Stuart', 'Sunny Isles Beach', 'Sunrise', 'Surfside',
    'Sweetwater', 'Tallahassee', 'Tamarac', 'Tampa', 'Tarpon Springs', 'Tavares', 'Temple Terrace', 'Tequesta', 'Titusville', 'Treasure Island', 'Trenton',
    'Umatilla', 'Valparaiso', 'Venice', 'Vernon', 'Vero Beach', 'Viera', 'Village of Golf', 'Village of Indian Creek', 'Village of Palmetto Bay',
    'Village of Pinecrest', 'Village of Tequesta', 'Village of Wellington', 'Village of Westlake', 'Wakulla', 'Waldo', 'Wauchula', 'Webster', 'Weeki Wachee',
    'Wellington', 'West Melbourne', 'West Miami', 'West Palm Beach', 'West Park', 'Weston', 'Westville', 'Wewahitchka', 'White Springs', 'Wildwood',
    'Williston', 'Wilton Manors', 'Windermere', 'Winter Garden', 'Winter Haven', 'Winter Park', 'Winter Springs', 'Worthington Springs', 'Yankeetown',
    'Zellwood', 'Zolfo Springs'
  ],
  'Georgia': [
    'Acworth', 'Adel', 'Albany', 'Alpharetta', 'Americus', 'Athens', 'Atlanta', 'Augusta', 'Austell', 'Bainbridge',
    'Barnesville', 'Baxley', 'Blackshear', 'Blairsville', 'Blakely', 'Blue Ridge', 'Brunswick', 'Buford', 'Cairo', 'Calhoun',
    'Camilla', 'Canton', 'Carrollton', 'Cartersville', 'Cedartown', 'Chamblee', 'Clarkesville', 'Clarkston', 'Clayton', 'Cleveland',
    'Cochran', 'College Park', 'Columbus', 'Commerce', 'Conyers', 'Cordele', 'Covington', 'Cumming', 'Dahlonega', 'Dalton',
    'Darien', 'Decatur', 'Douglas', 'Douglasville', 'Dublin', 'Duluth', 'Dunwoody', 'East Point', 'Eatonton', 'Elberton',
    'Ellijay', 'Evans', 'Fairburn', 'Fayetteville', 'Fitzgerald', 'Folkston', 'Forest Park', 'Fort Valley', 'Gainesville', 'Garden City',
    'Griffin', 'Hampton', 'Hapeville', 'Hartwell', 'Hawkinsville', 'Hazlehurst', 'Hinesville', 'Jackson', 'Jesup', 'Jonesboro',
    'Kennesaw', 'Kingsland', 'Kingsland', 'LaGrange', 'Lawrenceville', 'Lilburn', 'Lithonia', 'Loganville', 'Macon', 'Marietta',
    'McDonough', 'McRae', 'Milledgeville', 'Monroe', 'Morrow', 'Moultrie', 'Newnan', 'Norcross', 'Oakwood', 'Peachtree City',
    'Perry', 'Pooler', 'Powder Springs', 'Richmond Hill', 'Riverdale', 'Rockmart', 'Rome', 'Roswell', 'Sandy Springs', 'Savannah',
    'Smyrna', 'Snellville', 'Statesboro', 'Stockbridge', 'Stone Mountain', 'Suwanee', 'Swainsboro', 'Sylvester', 'Thomaston', 'Thomasville',
    'Thomson', 'Tifton', 'Tucker', 'Tyrone', 'Union City', 'Valdosta', 'Vidalia', 'Villa Rica', 'Warner Robins',
    'Waycross', 'Waynesboro', 'West Point', 'Winder', 'Woodstock'
  ],
  'Hawaii': [
    'Aiea', 'Captain Cook', 'Ewa Beach', 'Ewa Gentry', 'Haleiwa', 'Hana', 'Hanamaulu', 'Hanapepe', 'Hauula', 'Hawaiian Paradise Park',
    'Hawaiian Paradise Park', 'Hawi', 'Hickam Housing', 'Hilo', 'Holualoa', 'Honokaa', 'Honolulu', 'Honomu', 'Kahaluu', 'Kahuku',
    'Kahului', 'Kailua', 'Kailua-Kona', 'Kalaheo', 'Kalaoa', 'Kaneohe', 'Kapaa', 'Kapaau', 'Kapolei', 'Kaunakakai',
    'Kawaihae', 'Keaau', 'Kealakekua', 'Kekaha', 'Kihei', 'Kilauea', 'Koloa', 'Kurtistown', 'Lahaina', 'Laie',
    'Lanai City', 'Lawai', 'Lihue', 'Makaha', 'Makakilo', 'Makawao', 'Maunawili', 'Mililani Town', 'Mountain View', 'Nanakuli',
    'Nanawale Estates', 'Ocean View', 'Paauilo', 'Pahala', 'Pahoa', 'Pearl City', 'Pepeekeo', 'Princeville', 'Pukalani', 'Schofield Barracks',
    'Village Park', 'Volcano', 'Wahiawa', 'Waialua', 'Waianae', 'Wailuku', 'Waimalu', 'Waimanalo', 'Waimea', 'Waipahu',
    'Waipio Acres', 'Wheeler AFB'
  ],
  'Idaho': [
    'Aberdeen', 'Acequia', 'Albion', 'American Falls', 'Ammon', 'Arco', 'Arimo', 'Ashton', 'Athol', 'Atomic City',
    'Bancroft', 'Bayview', 'Bellevue', 'Blackfoot', 'Bliss', 'Bloomington', 'Boise', 'Bonners Ferry', 'Bovill', 'Buhl',
    'Burley', 'Butte City', 'Caldwell', 'Cambridge', 'Carey', 'Cascade', 'Castleford', 'Challis', 'Chubbuck', 'Clark Fork',
    'Clayton', 'Clifton', 'Coeur d\'Alene', 'Cottonwood', 'Council', 'Craigmont', 'Crouch', 'Culdesac', 'Dalton Gardens', 'Dayton',
    'Deary', 'Declo', 'Dietrich', 'Donnelly', 'Dover', 'Downey', 'Driggs', 'Drummond', 'Dubois', 'Eagle',
    'East Hope', 'Eden', 'Elk River', 'Emmett', 'Fairfield', 'Ferdinand', 'Fernan Lake Village', 'Filer', 'Firth', 'Franklin',
    'Fruitland', 'Garden City', 'Genesee', 'Georgetown', 'Glenns Ferry', 'Gooding', 'Grace', 'Grand View', 'Grangeville', 'Greenleaf',
    'Hagerman', 'Hailey', 'Hamer', 'Hansen', 'Harrison', 'Hauser', 'Hayden', 'Hayden Lake', 'Hazelton', 'Heyburn',
    'Hollister', 'Homedale', 'Horseshoe Bend', 'Huetter', 'Idaho City', 'Idaho Falls', 'Inkom', 'Iona', 'Irwin', 'Island Park',
    'Jerome', 'Juliaetta', 'Kamiah', 'Kellogg', 'Kendrick', 'Ketchum', 'Kimberly', 'Kingston', 'Kootenai', 'Kuna',
    'Lapwai', 'Lava Hot Springs', 'Leadore', 'Lewiston', 'Lewisville', 'Lost River', 'Mackay', 'Malad City', 'Marsing', 'McCall',
    'McCammon', 'Melba', 'Menan', 'Meridian', 'Middleton', 'Midvale', 'Minidoka', 'Montpelier', 'Moore', 'Moscow',
    'Mountain Home', 'Moyie Springs', 'Mullan', 'Murphy', 'Murtaugh', 'Nampa', 'New Meadows', 'New Plymouth', 'Newdale', 'Nezperce',
    'Notus', 'Oakley', 'Oldtown', 'Orofino', 'Osburn', 'Oxford', 'Paris', 'Parker', 'Parma', 'Paul',
    'Payette', 'Pocatello', 'Ponderay', 'Post Falls', 'Potlatch', 'Preston', 'Priest River', 'Rathdrum', 'Reubens', 'Rexburg',
    'Richfield', 'Rigby', 'Riggins', 'Ririe', 'Roberts', 'Rockland', 'Rupert', 'Salmon', 'Sandpoint', 'Shelley',
    'Shoshone', 'Smelterville', 'Soda Springs', 'Spencer', 'Spirit Lake', 'St. Anthony', 'St. Charles', 'St. Maries', 'Stanley', 'Stanton Crossing',
    'Star', 'State Line', 'Sugar City', 'Sun Valley', 'Swan Valley', 'Tensed', 'Teton', 'Tetonia', 'Troy', 'Twin Falls',
    'Ucon', 'Victor', 'Wallace', 'Wardner', 'Warm River', 'Weippe', 'Weiser', 'Wendell', 'Weston', 'White Bird',
    'Wilder', 'Winchester', 'Worley'
  ],
  'Illinois': [
    'Addison', 'Algonquin', 'Alsip', 'Antioch', 'Arlington Heights', 'Aurora', 'Barrington', 'Bartlett', 'Batavia', 'Belleville',
    'Bellwood', 'Belvidere', 'Berwyn', 'Bloomingdale', 'Bloomington', 'Blue Island', 'Bolingbrook', 'Bourbonnais', 'Bradley', 'Bridgeview',
    'Brookfield', 'Buffalo Grove', 'Burbank', 'Calumet City', 'Canton', 'Carbondale', 'Carol Stream', 'Carpentersville', 'Cary', 'Champaign',
    'Channahon', 'Charleston', 'Chicago', 'Chicago Heights', 'Chicago Ridge', 'Cicero', 'Crystal Lake', 'Danville', 'Decatur', 'DeKalb',
    'Des Plaines', 'Dixon', 'Downers Grove', 'East Moline', 'East Peoria', 'Edwardsville', 'Elgin', 'Elk Grove Village', 'Elmhurst', 'Elmwood Park',
    'Evanston', 'Evergreen Park', 'Flossmoor', 'Forest Park', 'Frankfort', 'Franklin Park', 'Freeport', 'Galesburg', 'Geneva', 'Glen Ellyn',
    'Glenview', 'Glenwood', 'Gurnee', 'Hanover Park', 'Harvey', 'Highland Park', 'Hinsdale', 'Hoffman Estates', 'Homewood', 'Joliet',
    'Kankakee', 'La Grange', 'Lake Forest', 'Lake in the Hills', 'Lake Zurich', 'Lansing', 'Lemont', 'Libertyville', 'Lincoln', 'Lincolnwood',
    'Lisle', 'Lockport', 'Lombard', 'Loves Park', 'Machesney Park', 'Macomb', 'Marion', 'Matteson', 'Maywood', 'McHenry',
    'Melrose Park', 'Mendota', 'Midlothian', 'Minooka', 'Mokena', 'Moline', 'Montgomery', 'Morton', 'Morton Grove', 'Mount Prospect',
    'Mount Vernon', 'Mundelein', 'Naperville', 'New Lenox', 'Niles', 'Normal', 'North Chicago', 'North Riverside', 'Northbrook', 'Northlake',
    'Oak Forest', 'Oak Lawn', 'Oak Park', 'Oakland', 'Orland Park', 'Oswego', 'Ottawa', 'Palatine', 'Palos Heights', 'Palos Hills',
    'Park Forest', 'Park Ridge', 'Pekin', 'Peoria', 'Plainfield', 'Pontiac', 'Quincy', 'Rantoul', 'Richton Park', 'River Forest',
    'River Grove', 'Riverdale', 'Riverside', 'Riverside', 'Rock Island', 'Rockford', 'Rolling Meadows', 'Romeoville', 'Roselle', 'Rosemont',
    'Round Lake', 'Round Lake Beach', 'Round Lake Park', 'Schaumburg', 'Schiller Park', 'Shorewood', 'Skokie', 'South Elgin', 'South Holland', 'Springfield',
    'St. Charles', 'Streamwood', 'Sycamore', 'Tinley Park', 'University Park', 'Urbana', 'Vernon Hills', 'Villa Park', 'Waukegan', 'West Chicago',
    'Westmont', 'Wheaton', 'Wheeling', 'Willowbrook', 'Wilmette', 'Winnebago', 'Winnetka', 'Wood Dale', 'Woodridge', 'Woodstock',
    'Worth', 'Yorkville', 'Zion'
  ],
  'Indiana': [
    'Alexandria', 'Anderson', 'Angola', 'Auburn', 'Aurora', 'Austin', 'Avon', 'Bedford', 'Beech Grove', 'Berkley',
    'Bicknell', 'Bloomfield', 'Bloomington', 'Bluffton', 'Brazil', 'Brookville', 'Brownsburg', 'Carmel', 'Cedar Lake', 'Charlestown',
    'Chesterton', 'Clarksville', 'Columbia City', 'Columbus', 'Connersville', 'Corydon', 'Crawfordsville', 'Crown Point', 'Danville', 'Decatur',
    'Delphi', 'Dyer', 'East Chicago', 'Elkhart', 'Elwood', 'Evansville', 'Fishers', 'Fort Wayne', 'Frankfort', 'Franklin',
    'Gary', 'Gas City', 'Goshen', 'Granger', 'Greencastle', 'Greenfield', 'Greensburg', 'Greenwood', 'Griffith', 'Hammond',
    'Hartford City', 'Highland', 'Hobart', 'Huntington', 'Indianapolis', 'Jasper', 'Jeffersonville', 'Kendallville', 'Kokomo', 'La Porte',
    'Lafayette', 'Lake Station', 'Lawrence', 'Lebanon', 'Logansport', 'Madison', 'Marion', 'Martinsville', 'Michigan City', 'Mishawaka',
    'Mount Vernon', 'Muncie', 'Munster', 'Nappanee', 'New Albany', 'New Castle', 'New Haven', 'Noblesville', 'North Vernon', 'Peru',
    'Plymouth', 'Portage', 'Princeton', 'Richmond', 'Rushville', 'Salem', 'Schererville', 'Scottsburg', 'Seymour', 'Shelbyville',
    'South Bend', 'Speedway', 'Sullivan', 'Terre Haute', 'Valparaiso', 'Vincennes', 'Wabash', 'Warsaw', 'Washington', 'West Lafayette',
    'Westfield', 'Whiting', 'Winchester', 'Winona Lake', 'Zionsville'
  ],
  'Iowa': [
    'Adel', 'Albia', 'Algona', 'Altoona', 'Ames', 'Anamosa', 'Ankeny', 'Atlantic', 'Bettendorf', 'Bloomfield',
    'Blue Grass', 'Bondurant', 'Boone', 'Burlington', 'Carroll', 'Cedar Falls', 'Cedar Rapids', 'Centerville', 'Charles City', 'Clarinda',
    'Clarion', 'Clinton', 'Clive', 'Coralville', 'Council Bluffs', 'Creston', 'Davenport', 'Decorah', 'Denison', 'Des Moines',
    'Dubuque', 'Dyersville', 'Eagle Grove', 'Eldora', 'Eldridge', 'Elkader', 'Emmetsburg', 'Estherville', 'Fairfield', 'Forest City',
    'Fort Dodge', 'Fort Madison', 'Garner', 'Glenwood', 'Grimes', 'Grinnell', 'Grundy Center', 'Guthrie Center', 'Hampton', 'Harlan',
    'Hiawatha', 'Humboldt', 'Independence', 'Indianola', 'Iowa City', 'Iowa Falls', 'Jefferson', 'Johnston', 'Keokuk', 'Knoxville',
    'La Porte City', 'Lake City', 'Le Mars', 'Le Claire', 'Lenox', 'Leon', 'Maquoketa', 'Marshalltown', 'Mason City', 'Milford',
    'Missouri Valley', 'Monticello', 'Mount Pleasant', 'Mount Vernon', 'Muscatine', 'Nevada', 'New Hampton', 'Newton', 'North Liberty', 'Northwood',
    'Oelwein', 'Orange City', 'Osceola', 'Oskaloosa', 'Ottumwa', 'Pella', 'Perry', 'Pleasant Hill', 'Pleasant Valley', 'Polk City',
    'Red Oak', 'Riverside', 'Rock Rapids', 'Rockwell City', 'Sac City', 'Shenandoah', 'Sheldon', 'Shell Rock', 'Sibley', 'Sioux Center',
    'Sioux City', 'Spencer', 'Spirit Lake', 'Storm Lake', 'Story City', 'Tama', 'Urbandale', 'Vinton', 'Waukee', 'Waukon',
    'Waverly', 'Webster City', 'West Burlington', 'West Des Moines', 'West Liberty', 'West Union', 'Williamsburg', 'Windsor Heights', 'Winterset'
  ],
  'Kansas': [
    'Abilene', 'Andover', 'Arkansas City', 'Atchison', 'Augusta', 'Baldwin City', 'Basehor', 'Baxter Springs', 'Bel Aire', 'Beloit',
    'Bonner Springs', 'Burlington', 'Chanute', 'Cimarron', 'Clay Center', 'Coffeyville', 'Colby', 'Concordia', 'De Soto', 'Dodge City',
    'El Dorado', 'Elkhart', 'Ellis', 'Ellsworth', 'Emporia', 'Eudora', 'Fairway', 'Fort Scott', 'Frontenac', 'Garden City',
    'Gardner', 'Girard', 'Goodland', 'Great Bend', 'Hays', 'Haysville', 'Hiawatha', 'Hillsboro', 'Hutchinson', 'Independence',
    'Iola', 'Junction City', 'Kansas City', 'Kingman', 'Larned', 'Lawrence', 'Leavenworth', 'Leawood', 'Lenexa', 'Liberal',
    'Lindsborg', 'Lyon County', 'Manhattan', 'McPherson', 'Merriam', 'Mission', 'Mission Hills', 'Mission Woods', 'Mound City', 'Moundridge',
    'Mulvane', 'Neodesha', 'Newton', 'Norton', 'Oakley', 'Olathe', 'Osawatomie', 'Ottawa', 'Overland Park', 'Paola',
    'Parsons', 'Pittsburg', 'Prairie Village', 'Pratt', 'Roeland Park', 'Russell', 'Salina', 'Scott City', 'Shawnee', 'Spring Hill',
    'St. Marys', 'Topeka', 'Ulysses', 'Valley Center', 'Wellington', 'Westwood', 'Wichita', 'Winfield', 'Yates Center'
  ],
  'Kentucky': [
    'Alexandria', 'Ashland', 'Barbourville', 'Bardstown', 'Beattyville', 'Bedford', 'Benton', 'Berea', 'Bowling Green', 'Brandenburg',
    'Brooksville', 'Burlington', 'Cadiz', 'Calhoun', 'Campbellsville', 'Carrollton', 'Catlettsburg', 'Cave City', 'Central City', 'Clinton',
    'Columbia', 'Corbin', 'Covington', 'Cynthiana', 'Danville', 'Dawson Springs', 'Dayton', 'Dixon', 'Eddyville', 'Elizabethtown',
    'Elsmere', 'Erlanger', 'Falmouth', 'Flemingsburg', 'Florence', 'Fort Mitchell', 'Fort Thomas', 'Frankfort', 'Franklin', 'Fulton',
    'Georgetown', 'Glasgow', 'Graymoor-Devondale', 'Grayson', 'Greenville', 'Guthrie', 'Harlan', 'Harrodsburg', 'Hazard', 'Henderson',
    'Hickman', 'Highland Heights', 'Hodgenville', 'Hopkinsville', 'Independence', 'Irvine', 'Jackson', 'Jamestown', 'Jeffersontown', 'Jenkins',
    'Junction City', 'La Grange', 'Lancaster', 'Lawrenceburg', 'Lebanon', 'Leitchfield', 'Lexington', 'Liberty', 'London', 'Louisville',
    'Ludlow', 'Lynch', 'Madisonville', 'Manchester', 'Mayfield', 'Maysville', 'Middlesboro', 'Midway', 'Monticello', 'Morehead',
    'Morganfield', 'Mount Sterling', 'Mount Washington', 'Murray', 'Newport', 'Nicholasville', 'Oak Grove', 'Olive Hill', 'Owensboro', 'Paducah',
    'Paris', 'Pikeville', 'Pineville', 'Prestonsburg', 'Princeton', 'Providence', 'Richmond', 'Russellville', 'Salyersville', 'Scottsville',
    'Shelbyville', 'Shepherdsville', 'Somerset', 'Southgate', 'Stanford', 'Stanton', 'Somerset', 'Taylor Mill', 'Tompkinsville', 'Vanceburg',
    'Versailles', 'Villa Hills', 'Walton', 'West Liberty', 'Whitesburg', 'Wickliffe', 'Wilder', 'Williamsburg', 'Williamstown', 'Winchester'
  ],
  'Louisiana': [
    'Abbeville', 'Alexandria', 'Arcadia', 'Baker', 'Bastrop', 'Baton Rouge', 'Bogalusa', 'Bossier City', 'Breaux Bridge', 'Broussard',
    'Carencro', 'Central', 'Chalmette', 'Covington', 'Crowley', 'DeRidder', 'Denham Springs', 'Destrehan', 'Donaldsonville', 'Eunice',
    'Ferriday', 'Franklin', 'Gonzales', 'Gretna', 'Hammond', 'Harahan', 'Harvey', 'Houma', 'Independence', 'Jeanerette',
    'Jennings', 'Kenner', 'Lafayette', 'Lake Charles', 'Laplace', 'Leesville', 'Mandeville', 'Marksville', 'Metairie', 'Monroe',
    'Morgan City', 'Natchitoches', 'New Iberia', 'New Orleans', 'New Roads', 'Oakdale', 'Opelousas', 'Pineville', 'Plaquemine', 'Ponchatoula',
    'Port Allen', 'Ruston', 'Shreveport', 'Slidell', 'Sulphur', 'Thibodaux', 'Ville Platte', 'West Monroe', 'Westwego', 'Winnfield',
    'Winnsboro', 'Youngsville', 'Zachary'
  ],
  'Maine': [
    'Auburn', 'Augusta', 'Bangor', 'Bar Harbor', 'Bath', 'Belfast', 'Biddeford', 'Brewer', 'Brunswick', 'Calais',
    'Camden', 'Caribou', 'Cumberland', 'Eastport', 'Ellsworth', 'Fairfield', 'Falmouth', 'Farmington', 'Fort Kent', 'Freeport',
    'Gardiner', 'Gorham', 'Hallowell', 'Houlton', 'Kennebunk', 'Kennebunkport', 'Kittery', 'Lewiston', 'Lisbon', 'Machias',
    'Madawaska', 'Millinocket', 'New Gloucester', 'Newport', 'North Berwick', 'Oakland', 'Old Orchard Beach', 'Old Town', 'Orono', 'Portland',
    'Presque Isle', 'Rockland', 'Rumford', 'Saco', 'Sanford', 'Scarborough', 'Skowhegan', 'South Portland', 'Topsham', 'Waldoboro',
    'Waterville', 'Westbrook', 'Winslow', 'Wiscasset', 'Yarmouth', 'York'
  ],
  'Maryland': [
    'Aberdeen', 'Accident', 'Annapolis', 'Baltimore', 'Bel Air', 'Berlin', 'Bethesda', 'Bladensburg', 'Bowie', 'Cambridge',
    'Capitol Heights', 'Catonsville', 'Chestertown', 'Chevy Chase', 'College Park', 'Cumberland', 'Dundalk', 'Easton', 'Elkton', 'Frederick',
    'Frederick', 'Frostburg', 'Gaithersburg', 'Garrett Park', 'Glen Burnie', 'Greenbelt', 'Hagerstown', 'Havre de Grace', 'Hyattsville', 'Kensington',
    'Laurel', 'Leonardtown', 'Mount Rainier', 'New Carrollton', 'Ocean City', 'Pocomoke City', 'Poolesville', 'Princess Anne', 'Rockville', 'Salisbury',
    'Silver Spring', 'Somerset', 'Takoma Park', 'Taneytown', 'Towson', 'Upper Marlboro', 'Westminster'
  ],
  'Massachusetts': [
    'Abington', 'Acton', 'Acushnet', 'Adams', 'Agawam', 'Amesbury', 'Amherst', 'Andover', 'Arlington', 'Ashburnham',
    'Ashby', 'Ashfield', 'Ashland', 'Athol', 'Attleboro', 'Auburn', 'Avon', 'Ayer', 'Barnstable', 'Barre',
    'Becket', 'Bedford', 'Belchertown', 'Bellingham', 'Belmont', 'Berkley', 'Berlin', 'Bernardston', 'Beverly', 'Billerica',
    'Blackstone', 'Blandford', 'Bolton', 'Boston', 'Bourne', 'Boxborough', 'Boxford', 'Boylston', 'Braintree', 'Brewster',
    'Bridgewater', 'Brimfield', 'Brockton', 'Brookfield', 'Brookline', 'Brookline', 'Buckland', 'Burlington', 'Cambridge', 'Canton',
    'Carlisle', 'Carver', 'Charlemont', 'Charlton', 'Chatham', 'Chelmsford', 'Chelsea', 'Cheshire', 'Chester', 'Chesterfield',
    'Chicopee', 'Chilmark', 'Clarksburg', 'Clinton', 'Cohasset', 'Concord', 'Conway', 'Cummington', 'Dalton', 'Danvers',
    'Dartmouth', 'Dedham', 'Deerfield', 'Dennis', 'Dighton', 'Douglas', 'Dover', 'Dracut', 'Dudley', 'Dunstable',
    'Duxbury', 'East Bridgewater', 'East Brookfield', 'East Longmeadow', 'Eastham', 'Easthampton', 'Easton', 'Edgartown', 'Egremont', 'Erving',
    'Essex', 'Everett', 'Fairhaven', 'Fall River', 'Falmouth', 'Fitchburg', 'Florida', 'Foxborough', 'Framingham', 'Franklin',
    'Freetown', 'Gardner', 'Georgetown', 'Gill', 'Gloucester', 'Goshen', 'Gosnold', 'Grafton', 'Granby', 'Granville',
    'Great Barrington', 'Greenfield', 'Groton', 'Groveland', 'Hadley', 'Halifax', 'Hamilton', 'Hampden', 'Hancock', 'Hanover',
    'Hanson', 'Hardwick', 'Harvard', 'Harwich', 'Hatfield', 'Haverhill', 'Hawley', 'Heath', 'Hingham', 'Hinsdale',
    'Holbrook', 'Holden', 'Holland', 'Holliston', 'Holyoke', 'Hopedale', 'Hopkinton', 'Hubbardston', 'Hudson', 'Hull',
    'Huntington', 'Ipswich', 'Kingston', 'Lakeville', 'Lancaster', 'Lanesborough', 'Lawrence', 'Lee', 'Leicester', 'Lenox',
    'Leominster', 'Leverett', 'Lexington', 'Leyden', 'Lincoln', 'Littleton', 'Longmeadow', 'Lowell', 'Ludlow', 'Lunenburg',
    'Lynn', 'Lynnfield', 'Malden', 'Manchester-by-the-Sea', 'Mansfield', 'Marblehead', 'Marion', 'Marlborough', 'Marshfield', 'Mashpee',
    'Mattapoisett', 'Maynard', 'Medfield', 'Medford', 'Medway', 'Melrose', 'Mendon', 'Merrimac', 'Methuen', 'Middleborough',
    'Middlefield', 'Middleton', 'Milford', 'Millbury', 'Millis', 'Millville', 'Milton', 'Monroe', 'Monson', 'Montague',
    'Monterey', 'Montgomery', 'Mount Washington', 'Nahant', 'Nantucket', 'Natick', 'Needham', 'New Bedford', 'New Braintree', 'New Marlborough',
    'New Salem', 'Newbury', 'Newburyport', 'Newton', 'Norfolk', 'North Adams', 'North Andover', 'North Attleborough', 'North Brookfield', 'North Reading',
    'Northampton', 'Northborough', 'Northbridge', 'Northfield', 'Norton', 'Norwell', 'Norwood', 'Oak Bluffs', 'Oakham', 'Orange',
    'Orleans', 'Otis', 'Oxford', 'Palmer', 'Paxton', 'Peabody', 'Pelham', 'Pembroke', 'Pepperell', 'Peru',
    'Petersham', 'Pittsfield', 'Plainfield', 'Plainville', 'Plymouth', 'Plympton', 'Princeton', 'Provincetown', 'Quincy', 'Randolph',
    'Raynham', 'Reading', 'Rehoboth', 'Revere', 'Richmond', 'Rochester', 'Rockland', 'Rockport', 'Rowe', 'Rowley',
    'Royalston', 'Russell', 'Salem', 'Salisbury', 'Sandisfield', 'Sandwich', 'Saugus', 'Savoy', 'Scituate', 'Seekonk',
    'Sharon', 'Sheffield', 'Shelburne', 'Sherborn', 'Shirley', 'Shrewsbury', 'Shutesbury', 'Somerset', 'Somerville', 'South Hadley',
    'Southampton', 'Southborough', 'Southbridge', 'Southwick', 'Spencer', 'Springfield', 'Sterling', 'Stockbridge', 'Stoneham', 'Stoughton',
    'Stow', 'Sturbridge', 'Sudbury', 'Sunderland', 'Sutton', 'Swampscott', 'Swansea', 'Taunton', 'Templeton', 'Tewksbury',
    'Tisbury', 'Tolland', 'Topsfield', 'Townsend', 'Truro', 'Tyngsborough', 'Tyringham', 'Upton', 'Uxbridge', 'Wakefield',
    'Wales', 'Walpole', 'Waltham', 'Ware', 'Wareham', 'Warren', 'Warwick', 'Watertown', 'Wayland', 'Webster',
    'Wellesley', 'Wellfleet', 'Wendell', 'Wenham', 'West Boylston', 'West Bridgewater', 'West Brookfield', 'West Newbury', 'West Springfield', 'West Tisbury',
    'Westborough', 'Westfield', 'Westford', 'Westhampton', 'Westminster', 'Weston', 'Westport', 'Westwood', 'Weymouth', 'Whately',
    'Whitman', 'Wilbraham', 'Williamsburg', 'Williamstown', 'Wilmington', 'Winchendon', 'Winchester', 'Winthrop', 'Woburn', 'Worcester',
    'Worthington', 'Wrentham', 'Yarmouth'
  ],
  'Michigan': [
    'Adrian', 'Allen Park', 'Alma', 'Ann Arbor', 'Auburn Hills', 'Battle Creek', 'Bay City', 'Berkley', 'Beverly Hills', 'Big Rapids',
    'Birmingham', 'Bloomfield Hills', 'Bloomfield Township', 'Bridgman', 'Brighton', 'Burton', 'Cadillac', 'Canton', 'Chesterfield', 'Clarkston',
    'Clawson', 'Clinton Township', 'Coldwater', 'Commerce Township', 'Dearborn', 'Dearborn Heights', 'Detroit', 'East Lansing', 'Eastpointe', 'Escanaba',
    'Farmington', 'Farmington Hills', 'Ferndale', 'Flint', 'Flushing', 'Forest Hills', 'Fraser', 'Garden City', 'Grand Blanc', 'Grand Haven',
    'Grand Rapids', 'Grandville', 'Grosse Pointe', 'Grosse Pointe Farms', 'Grosse Pointe Park', 'Grosse Pointe Woods', 'Hamtramck', 'Harper Woods', 'Haslett', 'Hazel Park',
    'Highland Park', 'Holland', 'Holt', 'Houghton', 'Howell', 'Huntington Woods', 'Inkster', 'Jackson', 'Kalamazoo', 'Kentwood',
    'Lansing', 'Lapeer', 'Lincoln Park', 'Livonia', 'Madison Heights', 'Manistee', 'Marquette', 'Mason', 'Melvindale', 'Midland',
    'Monroe', 'Mount Clemens', 'Mount Pleasant', 'Muskegon', 'Muskegon Heights', 'New Baltimore', 'Niles', 'Northville', 'Norton Shores', 'Novi',
    'Oak Park', 'Okemos', 'Owosso', 'Oxford', 'Petoskey', 'Plymouth', 'Pontiac', 'Port Huron', 'Portage', 'Redford',
    'Rochester', 'Rochester Hills', 'Romulus', 'Roseville', 'Royal Oak', 'Saginaw', 'Saint Clair Shores', 'Saint Joseph', 'Saline', 'Shelby',
    'Shelby Township', 'Southfield', 'Southgate', 'South Lyon', 'Springfield', 'St. Clair Shores', 'St. Joseph', 'Sterling Heights', 'Sturgis', 'Taylor',
    'Tecumseh', 'Temperance', 'Trenton', 'Troy', 'Utica', 'Warren', 'Waterford', 'Wayne', 'West Bloomfield', 'Westland',
    'White Lake', 'Whitehall', 'Wixom', 'Woodhaven', 'Wyandotte', 'Wyoming', 'Ypsilanti'
  ],
  'Minnesota': [
    'Albert Lea', 'Alexandria', 'Andover', 'Anoka', 'Apple Valley', 'Arden Hills', 'Austin', 'Baxter', 'Bemidji', 'Big Lake',
    'Blaine', 'Bloomington', 'Brainerd', 'Brooklyn Center', 'Brooklyn Park', 'Buffalo', 'Burnsville', 'Champlin', 'Chanhassen', 'Chaska',
    'Cloquet', 'Columbia Heights', 'Coon Rapids', 'Cottage Grove', 'Crookston', 'Crystal', 'Duluth', 'Eagan', 'East Bethel', 'Eden Prairie',
    'Edina', 'Elk River', 'Ely', 'Eveleth', 'Fairmont', 'Faribault', 'Fergus Falls', 'Forest Lake', 'Fridley', 'Golden Valley',
    'Grand Rapids', 'Hastings', 'Hibbing', 'Hopkins', 'Inver Grove Heights', 'Lakeville', 'Lino Lakes', 'Little Canada', 'Little Falls', 'Mankato',
    'Maple Grove', 'Maplewood', 'Marshall', 'Mendota Heights', 'Minneapolis', 'Minnetonka', 'Minnetonka Mills', 'Moorhead', 'Mounds View', 'New Brighton',
    'New Hope', 'New Ulm', 'North Mankato', 'North St. Paul', 'Northfield', 'Oakdale', 'Oakland Park', 'Owatonna', 'Plymouth', 'Prior Lake',
    'Ramsey', 'Red Wing', 'Richfield', 'Rochester', 'Rosemount', 'Roseville', 'Sartell', 'Savage', 'Shakopee', 'Shoreview',
    'Shorewood', 'South St. Paul', 'Spring Lake Park', 'St. Anthony', 'St. Cloud', 'St. Louis Park', 'St. Michael', 'St. Paul', 'St. Peter', 'Stillwater',
    'Vadnais Heights', 'Virginia', 'Waconia', 'Wadena', 'West St. Paul', 'White Bear Lake', 'Willmar', 'Winona', 'Woodbury', 'Worthington'
  ],
  'Mississippi': [
    'Aberdeen', 'Ackerman', 'Amory', 'Batesville', 'Bay St. Louis', 'Bay Springs', 'Biloxi', 'Booneville', 'Brandon', 'Brookhaven',
    'Brookhaven', 'Canton', 'Clarksdale', 'Cleveland', 'Clinton', 'Columbus', 'Corinth', 'Crystal Springs', 'D\'Iberville', 'Diamondhead',
    'Duck Hill', 'Durant', 'Eupora', 'Florence', 'Flowood', 'Forest', 'Fulton', 'Gautier', 'Grenada', 'Greenville',
    'Greenwood', 'Gulfport', 'Gulfport', 'Hattiesburg', 'Hazlehurst', 'Hernando', 'Holly Springs', 'Horn Lake', 'Indianola', 'Jackson',
    'Kosciusko', 'Laurel', 'Long Beach', 'Louisville', 'Lucedale', 'Madison', 'Magee', 'McComb', 'Meridian', 'Moss Point',
    'Natchez', 'New Albany', 'Ocean Springs', 'Olive Branch', 'Oxford', 'Pascagoula', 'Pass Christian', 'Pearl', 'Philadelphia', 'Picayune',
    'Pontotoc', 'Poplarville', 'Port Gibson', 'Ridgeland', 'Ripley', 'Rolling Fork', 'Ruleville', 'Senatobia', 'Southaven', 'Starkville',
    'Tupelo', 'Tutwiler', 'Vicksburg', 'Waveland', 'West Point', 'West Point', 'Yazoo City'
  ],
  'Missouri': [
    'Adrian', 'Affton', 'Albany', 'Alton', 'Anderson', 'Archie', 'Arnold', 'Ash Grove', 'Ashland', 'Aurora',
    'Ballwin', 'Barnhart', 'Battlefield', 'Bel-Nor', 'Bel-Ridge', 'Bellefontaine Neighbors', 'Bellerive Acres', 'Belton', 'Berkeley', 'Bethany',
    'Beverly Hills', 'Black Jack', 'Blue Springs', 'Bolivar', 'Bonne Terre', 'Boonville', 'Bourbon', 'Branson', 'Brentwood', 'Bridgeton',
    'Brookfield', 'Brookside', 'Browning', 'Buchanan', 'Butler', 'California', 'Camdenton', 'Cameron', 'Cape Girardeau', 'Carrollton',
    'Carthage', 'Cassville', 'Centralia', 'Chaffee', 'Charlack', 'Chesterfield', 'Chillicothe', 'Clayton', 'Clinton', 'Columbia',
    'Concord', 'Cottleville', 'Country Club Hills', 'Creve Coeur', 'Crystal City', 'Dardenne Prairie', 'De Soto', 'Des Peres', 'Desloge', 'Dexter',
    'Doniphan', 'Duenweg', 'East Prairie', 'Edina', 'Edmundson', 'Eldon', 'Ellisville', 'Elsberry', 'Eureka', 'Excelsior Springs',
    'Farmington', 'Ferguson', 'Festus', 'Florissant', 'Forsyth', 'Fort Leonard Wood', 'Fulton', 'Gladstone', 'Glasgow', 'Glendale',
    'Grain Valley', 'Grandview', 'Gray Summit', 'Green Park', 'Greenfield', 'Greentop', 'Hannibal', 'Harrisonville', 'Hazelwood', 'Hermann',
    'Higginsville', 'High Ridge', 'Hillsboro', 'Hollister', 'Independence', 'Jackson', 'Jefferson City', 'Joplin', 'Kansas City', 'Kearney',
    'Kennett', 'Kirksville', 'Kirkwood', 'Ladue', 'Lake Saint Louis', 'Lamar', 'Lebanon', 'Lee\'s Summit', 'Lexington', 'Liberty',
    'Linn', 'Lonedell', 'Macon', 'Manchester', 'Maplewood', 'Marshfield', 'Maryland Heights', 'Maryville', 'Maysville', 'Mexico',
    'Moberly', 'Monett', 'Monroe City', 'Moscow Mills', 'Mound City', 'Mount Vernon', 'Neosho', 'Nevada', 'New Madrid', 'North Kansas City',
    'Northwoods', 'O\'Fallon', 'Oak Grove', 'Oakland', 'Odessa', 'Olivette', 'Overland', 'Owensville', 'Ozark', 'Pacific',
    'Park Hills', 'Parkville', 'Peculiar', 'Perryville', 'Piedmont', 'Platte City', 'Plattsburg', 'Pleasant Hill', 'Poplar Bluff', 'Raymore',
    'Raytown', 'Republic', 'Richmond', 'Richmond Heights', 'Riverside', 'Rocheport', 'Rock Hill', 'Rolla', 'Saint Ann', 'Saint Charles',
    'Saint Clair', 'Saint James', 'Saint Joseph', 'Saint Louis', 'Saint Peters', 'Saint Robert', 'Salem', 'Sedalia', 'Sikeston', 'Smithville',
    'Springfield', 'St. Charles', 'St. Joseph', 'St. Louis', 'St. Peters', 'Ste. Genevieve', 'Sullivan', 'Sunset Hills', 'Town and Country', 'Trenton',
    'Troy', 'Union', 'University City', 'Valley Park', 'Warrensburg', 'Warrenton', 'Washington', 'Webb City', 'Webster Groves', 'Wentzville',
    'West Plains', 'Wildwood', 'Willard', 'Windsor', 'Winfield', 'Woodson Terrace'
  ],
  'Montana': [
    'Anaconda', 'Baker', 'Belgrade', 'Billings', 'Bozeman', 'Butte', 'Columbia Falls', 'Deer Lodge', 'Dillon', 'East Helena',
    'Evergreen', 'Glendive', 'Great Falls', 'Hamilton', 'Havre', 'Helena', 'Kalispell', 'Laurel', 'Lewistown', 'Livingston',
    'Miles City', 'Missoula', 'Polson', 'Red Lodge', 'Ronan', 'Shelby', 'Sidney', 'Stevensville', 'Whitefish', 'Wolf Point'
  ],
  'Nebraska': [
    'Alliance', 'Auburn', 'Aurora', 'Beatrice', 'Bellevue', 'Blair', 'Broken Bow', 'Chadron', 'Columbus', 'Crete',
    'Falls City', 'Fremont', 'Gering', 'Grand Island', 'Hastings', 'Holdrege', 'Kearney', 'La Vista', 'Lexington', 'Lincoln',
    'McCook', 'Nebraska City', 'Norfolk', 'North Platte', 'Ogallala', 'Omaha', 'Papillion', 'Plattsmouth', 'Ralston', 'Scottsbluff',
    'Seward', 'Sidney', 'South Sioux City', 'Superior', 'Wayne', 'York'
  ],
  'Nevada': [
    'Boulder City', 'Carson City', 'Elko', 'Ely', 'Fallon', 'Fernley', 'Gardnerville', 'Henderson', 'Incline Village', 'Las Vegas',
    'Laughlin', 'Mesquite', 'North Las Vegas', 'Reno', 'Sparks', 'Stateline', 'Winnemucca'
  ],
  'New Hampshire': [
    'Amherst', 'Atkinson', 'Auburn', 'Bedford', 'Belmont', 'Berlin', 'Bow', 'Bristol', 'Brookline', 'Candia',
    'Canterbury', 'Chester', 'Concord', 'Danville', 'Derry', 'Dover', 'Durham', 'East Kingston', 'Epping', 'Exeter',
    'Franklin', 'Goffstown', 'Gorham', 'Greenfield', 'Greenland', 'Hampton', 'Hampton Falls', 'Hanover', 'Henniker', 'Hollis',
    'Hooksett', 'Hudson', 'Keene', 'Kingston', 'Laconia', 'Lebanon', 'Litchfield', 'Londonderry', 'Manchester', 'Merrimack',
    'Milford', 'Nashua', 'New Boston', 'New Castle', 'New Durham', 'New Hampton', 'New Ipswich', 'New London', 'Newmarket', 'Newport',
    'North Hampton', 'Northfield', 'Northwood', 'Nottingham', 'Pelham', 'Pembroke', 'Peterborough', 'Plaistow', 'Portsmouth', 'Raymond',
    'Rochester', 'Salem', 'Sandown', 'Seabrook', 'Somersworth', 'Stratham', 'Suncook', 'Swanzey', 'Tilton', 'Weare',
    'Windham', 'Wolfeboro'
  ],
  'New Jersey': [
    'Absecon', 'Asbury Park', 'Atlantic City', 'Avenel', 'Barnegat', 'Bayonne', 'Belleville', 'Bergenfield', 'Berkeley Heights', 'Berlin',
    'Bernards', 'Bloomfield', 'Bloomfield', 'Bogota', 'Boonton', 'Bound Brook', 'Bridgeton', 'Brigantine', 'Brooklawn', 'Burlington',
    'Caldwell', 'Camden', 'Cape May', 'Carteret', 'Cherry Hill', 'Cliffside Park', 'Clifton', 'Collingswood', 'Cranford', 'Cresskill',
    'Deal', 'Dover', 'Dumont', 'Dunellen', 'East Brunswick', 'East Orange', 'East Rutherford', 'Edison', 'Elizabeth', 'Elmwood Park',
    'Englewood', 'Englewood Cliffs', 'Ewing', 'Fair Lawn', 'Fairview', 'Fanwood', 'Flemington', 'Florham Park', 'Fort Lee', 'Franklin',
    'Freehold', 'Garfield', 'Glassboro', 'Glen Ridge', 'Gloucester City', 'Hackensack', 'Hackettstown', 'Haddon Heights', 'Haddonfield', 'Haledon',
    'Hamilton', 'Hammonton', 'Harrison', 'Hasbrouck Heights', 'Hawthorne', 'Highland Park', 'Hillsdale', 'Hoboken', 'Hopatcong', 'Irvington',
    'Iselin', 'Jersey City', 'Kearny', 'Kenilworth', 'Lakewood', 'Lawnside', 'Leonia', 'Lincoln Park', 'Linden', 'Little Falls',
    'Little Ferry', 'Livingston', 'Lodi', 'Long Branch', 'Lyndhurst', 'Madison', 'Mahwah', 'Manasquan', 'Manville', 'Maplewood',
    'Margate City', 'Matawan', 'Maywood', 'Metuchen', 'Middletown', 'Millburn', 'Millville', 'Montclair', 'Morristown', 'Mount Holly',
    'Mount Laurel', 'New Brunswick', 'New Milford', 'Newark', 'North Arlington', 'North Bergen', 'North Plainfield', 'Northfield', 'Nutley', 'Oakland',
    'Ocean City', 'Old Bridge', 'Orange', 'Palisades Park', 'Paramus', 'Parsippany', 'Passaic', 'Paterson', 'Perth Amboy', 'Phillipsburg',
    'Pine Hill', 'Piscataway', 'Plainfield', 'Pleasantville', 'Point Pleasant', 'Princeton', 'Rahway', 'Ramsey', 'Ridgefield', 'Ridgefield Park',
    'Ridgewood', 'Ringwood', 'River Edge', 'Roselle', 'Roselle Park', 'Rutherford', 'Salem', 'Sayreville', 'Scotch Plains', 'Secaucus',
    'Sewell', 'Somerville', 'South Amboy', 'South Orange', 'South Plainfield', 'South River', 'Summit', 'Teaneck', 'Tenafly', 'Toms River',
    'Trenton', 'Union', 'Union City', 'Ventnor City', 'Vineland', 'Waldwick', 'Wallington', 'Washington', 'Wayne', 'West New York',
    'West Orange', 'Westfield', 'Westwood', 'Wharton', 'Wildwood', 'Woodbridge', 'Woodbury', 'Woodcliff Lake', 'Wyckoff'
  ],
  'New Mexico': [
    'Alamogordo', 'Albuquerque', 'Anthony', 'Artesia', 'Aztec', 'Bayard', 'Belen', 'Bernalillo', 'Bloomfield', 'Carlsbad',
    'Clovis', 'Deming', 'Espanola', 'Farmington', 'Gallup', 'Grants', 'Hobbs', 'Las Cruces', 'Las Vegas', 'Lovington',
    'Los Alamos', 'Los Lunas', 'Lovington', 'Moriarty', 'Portales', 'Rio Rancho', 'Roswell', 'Ruidoso', 'Santa Fe', 'Silver City',
    'Socorro', 'Sunland Park', 'Taos', 'Truth or Consequences'
  ],
  'New York': [
    'Adams', 'Albany', 'Albion', 'Alden', 'Alexandria Bay', 'Altamont', 'Amherst', 'Amityville', 'Amsterdam', 'Angola',
    'Ardsley', 'Arlington', 'Astoria', 'Auburn', 'Babylon', 'Baldwin', 'Batavia', 'Bath', 'Bay Shore', 'Bayport',
    'Beacon', 'Bedford', 'Bellmore', 'Bethpage', 'Binghamton', 'Blasdell', 'Brentwood', 'Brewster', 'Brighton', 'Brockport',
    'Bronx', 'Brooklyn', 'Brooklyn Heights', 'Buffalo', 'Camillus', 'Canandaigua', 'Canton', 'Carmel', 'Catskill', 'Cedarhurst',
    'Central Islip', 'Central Square', 'Cheektowaga', 'Chester', 'Cicero', 'Clarence', 'Clarkstown', 'Clay', 'Cohoes', 'Colonie',
    'Commack', 'Cortland', 'Corning', 'Cortlandt', 'Croton-on-Hudson', 'Deer Park', 'Depew', 'Dobbs Ferry', 'Dunkirk', 'East Aurora',
    'East Hampton', 'East Islip', 'East Meadow', 'East Northport', 'East Patchogue', 'East Rochester', 'East Rockaway', 'Eastchester', 'Elmira', 'Elmont',
    'Elmsford', 'Endicott', 'Fairport', 'Farmingdale', 'Farmingville', 'Fishkill', 'Floral Park', 'Fort Salonga', 'Franklin Square', 'Freeport',
    'Garden City', 'Gates', 'Glen Cove', 'Glens Falls', 'Gloversville', 'Goshen', 'Grand Island', 'Great Neck', 'Greenburgh', 'Greenlawn',
    'Hamburg', 'Harrison', 'Hartsdale', 'Hastings-on-Hudson', 'Hauppauge', 'Hempstead', 'Henrietta', 'Hicksville', 'Holbrook', 'Holtsville',
    'Hornell', 'Horseheads', 'Huntington', 'Huntington Station', 'Irondequoit', 'Islip', 'Jamestown', 'Johnson City', 'Kenmore', 'Kings Park',
    'Kingston', 'Lackawanna', 'Lake Grove', 'Lake Ronkonkoma', 'Lancaster', 'Larchmont', 'Levittown', 'Lindenhurst', 'Lockport', 'Long Beach',
    'Lynbrook', 'Lynbrook', 'Malone', 'Malverne', 'Manhasset', 'Manhattan', 'Massapequa', 'Massapequa Park', 'Mastic', 'Mastic Beach',
    'Medford', 'Melville', 'Merrick', 'Middletown', 'Miller Place', 'Mineola', 'Monroe', 'Mount Kisco', 'Mount Vernon', 'Nanuet',
    'New City', 'New Hyde Park', 'New Rochelle', 'New Windsor', 'New York', 'Newark', 'Newburgh', 'Niagara Falls', 'North Babylon', 'North Bellmore',
    'North Massapequa', 'North Tonawanda', 'North Valley Stream', 'Northport', 'Oceanside', 'Ogdensburg', 'Olean', 'Oneida', 'Oneonta', 'Orchard Park',
    'Ossining', 'Oswego', 'Owego', 'Patchogue', 'Peekskill', 'Plainview', 'Plattsburgh', 'Pleasantville', 'Port Chester', 'Port Jefferson',
    'Port Jefferson Station', 'Port Washington', 'Poughkeepsie', 'Queens', 'Queensbury', 'Rensselaer', 'Ridge', 'Riverhead', 'Rochester', 'Rockville Centre',
    'Rocky Point', 'Ronkonkoma', 'Roosevelt', 'Rotterdam', 'Saratoga Springs', 'Sayville', 'Schenectady', 'Scotia', 'Selden', 'Shirley',
    'Smithtown', 'South Farmingdale', 'South Valley Stream', 'Spring Valley', 'Staten Island', 'Stony Brook', 'Stony Point', 'Suffern', 'Syosset', 'Syracuse',
    'Tonawanda', 'Troy', 'Uniondale', 'Utica', 'Valley Stream', 'Vestal', 'Wappingers Falls', 'Watertown', 'Webster', 'West Babylon',
    'West Hempstead', 'West Islip', 'West Seneca', 'Westbury', 'White Plains', 'Williamsville', 'Woodbury', 'Woodmere', 'Yonkers'
  ],
  'North Carolina': [
    'Aberdeen', 'Albemarle', 'Apex', 'Archdale', 'Asheboro', 'Asheville', 'Atlantic Beach', 'Ayden', 'Banner Elk', 'Belmont',
    'Benson', 'Bessemer City', 'Black Mountain', 'Boiling Spring Lakes', 'Boone', 'Brevard', 'Burlington', 'Carrboro', 'Cary', 'Chapel Hill',
    'Charlotte', 'Cherryville', 'Clayton', 'Clemmons', 'Clinton', 'Concord', 'Conover', 'Cornelius', 'Creedmoor', 'Davidson',
    'Dunn', 'Durham', 'Eden', 'Edenton', 'Elizabeth City', 'Elkin', 'Elon', 'Erwin', 'Fayetteville', 'Forest City',
    'Fort Bragg', 'Franklin', 'Fuquay-Varina', 'Garner', 'Gastonia', 'Goldsboro', 'Graham', 'Greensboro', 'Greenville', 'Havelock',
    'Henderson', 'Hendersonville', 'Hickory', 'High Point', 'Hillsborough', 'Holly Springs', 'Hope Mills', 'Huntersville', 'Indian Trail', 'Jacksonville',
    'Kannapolis', 'Kernersville', 'Kill Devil Hills', 'King', 'Kings Mountain', 'Kinston', 'Kitty Hawk', 'Knightdale', 'Laurinburg', 'Lenoir',
    'Lewisville', 'Lexington', 'Lillington', 'Lincolnton', 'Lumberton', 'Manteo', 'Marion', 'Matthews', 'Mebane', 'Mint Hill',
    'Monroe', 'Mooresville', 'Morehead City', 'Morganton', 'Morrisville', 'Mount Airy', 'Mount Holly', 'Murphy', 'Nags Head', 'New Bern',
    'Newton', 'North Wilkesboro', 'Oak Island', 'Oak Ridge', 'Oxford', 'Pinehurst', 'Pineville', 'Plymouth', 'Raleigh', 'Reidsville',
    'Roanoke Rapids', 'Rockingham', 'Rocky Mount', 'Roxboro', 'Salisbury', 'Sanford', 'Selma', 'Shelby', 'Smithfield', 'Southern Pines',
    'Spring Lake', 'St. Pauls', 'Statesville', 'Tarboro', 'Thomasville', 'Trinity', 'Troy', 'Valdese', 'Wake Forest', 'Washington',
    'Waxhaw', 'Waynesville', 'Wilkesboro', 'Wilmington', 'Wilson', 'Winston-Salem', 'Winterville', 'Woodfin', 'Wrightsville Beach', 'Zebulon'
  ],
  'North Dakota': [
    'Bismarck', 'Devils Lake', 'Dickinson', 'Fargo', 'Grand Forks', 'Jamestown', 'Mandan', 'Minot', 'Valley City', 'Wahpeton',
    'West Fargo', 'Williston'
  ],
  'Ohio': [
    'Akron', 'Alliance', 'Amherst', 'Ashland', 'Ashtabula', 'Athens', 'Aurora', 'Austintown', 'Avon', 'Avon Lake',
    'Barberton', 'Bay Village', 'Beachwood', 'Bedford', 'Bedford Heights', 'Bellefontaine', 'Berea', 'Boardman', 'Bowling Green', 'Brecksville',
    'Broadview Heights', 'Brook Park', 'Brooklyn', 'Brooklyn Heights', 'Brookville', 'Brunswick', 'Bryan', 'Bucyrus', 'Cambridge', 'Canal Winchester',
    'Canton', 'Centerville', 'Chagrin Falls', 'Chillicothe', 'Cincinnati', 'Circleville', 'Cleveland', 'Cleveland Heights', 'Cleveland Heights', 'Clyde',
    'Columbus', 'Conneaut', 'Cortland', 'Coshocton', 'Cuyahoga Falls', 'Dayton', 'Defiance', 'Delaware', 'Delphos', 'Dover',
    'Dublin', 'East Cleveland', 'Eastlake', 'Elyria', 'Englewood', 'Euclid', 'Fairborn', 'Fairfield', 'Fairlawn', 'Findlay',
    'Forest Park', 'Franklin', 'Fremont', 'Gahanna', 'Garfield Heights', 'Garfield Heights', 'Geneva', 'Girard', 'Grandview Heights', 'Green',
    'Greenville', 'Grove City', 'Hamilton', 'Harrison', 'Heath', 'Highland Heights', 'Hilliard', 'Hillsboro', 'Hudson', 'Independence',
    'Ironton', 'Jackson', 'Kent', 'Kettering', 'Lakewood', 'Lancaster', 'Lebanon', 'Lima', 'Lorain', 'Louisville',
    'Loveland', 'Lyndhurst', 'Macedonia', 'Mansfield', 'Maple Heights', 'Marion', 'Marysville', 'Massillon', 'Mayfield Heights', 'Medina',
    'Mentor', 'Mentor-on-the-Lake', 'Miamisburg', 'Middleburg Heights', 'Middletown', 'Milford', 'Monroe', 'Montgomery', 'Moraine', 'Mount Vernon',
    'New Albany', 'New Philadelphia', 'Newark', 'Niles', 'North Canton', 'North Olmsted', 'North Ridgeville', 'North Royalton', 'Northfield', 'Norton',
    'Norwalk', 'Norwood', 'Oberlin', 'Olmsted Falls', 'Oregon', 'Oxford', 'Painesville', 'Parma', 'Parma Heights', 'Pataskala',
    'Pepper Pike', 'Perrysburg', 'Pickerington', 'Piqua', 'Port Clinton', 'Portsmouth', 'Ravenna', 'Reynoldsburg', 'Richmond Heights', 'Riverside',
    'Rocky River', 'Sandusky', 'Seven Hills', 'Shaker Heights', 'Sharonville', 'Sheffield Lake', 'Shelby', 'Sidney', 'Solon', 'South Euclid',
    'Springboro', 'Springfield', 'St. Clairsville', 'St. Marys', 'Steubenville', 'Stow', 'Streetsboro', 'Strongsville', 'Struthers', 'Sylvania',
    'Tallmadge', 'Tiffin', 'Toledo', 'Trenton', 'Trotwood', 'Troy', 'Twinsburg', 'University Heights', 'Upper Arlington', 'Urbana',
    'Vandalia', 'Vermilion', 'Wadsworth', 'Warren', 'Warrensville Heights', 'Washington Court House', 'Wauseon', 'Westerville', 'Westlake', 'Wickliffe',
    'Willoughby', 'Willoughby Hills', 'Willowick', 'Wilmington', 'Wooster', 'Worthington', 'Xenia', 'Youngstown', 'Zanesville'
  ],
  'Oklahoma': [
    'Ada', 'Altus', 'Ardmore', 'Bartlesville', 'Bethany', 'Bixby', 'Blackwell', 'Broken Arrow', 'Chickasha', 'Claremore',
    'Clinton', 'Del City', 'Duncan', 'Durant', 'Edmond', 'El Reno', 'Enid', 'Guthrie', 'Guymon', 'Lawton',
    'McAlester', 'Midwest City', 'Moore', 'Muskogee', 'Norman', 'Oklahoma City', 'Owasso', 'Ponca City', 'Poteau', 'Sand Springs',
    'Sapulpa', 'Shawnee', 'Stillwater', 'Tahlequah', 'Tulsa', 'Woodward', 'Yukon'
  ],
  'Oregon': [
    'Albany', 'Ashland', 'Astoria', 'Baker City', 'Beaverton', 'Bend', 'Brookings', 'Burns', 'Canby', 'Central Point',
    'Coos Bay', 'Corvallis', 'Cottage Grove', 'Dallas', 'Eugene', 'Florence', 'Forest Grove', 'Grants Pass', 'Gresham', 'Hermiston',
    'Hillsboro', 'Hood River', 'Independence', 'Jacksonville', 'John Day', 'Klamath Falls', 'La Grande', 'Lake Oswego', 'Lebanon', 'Lincoln City',
    'McMinnville', 'Medford', 'Milton-Freewater', 'Monmouth', 'Newberg', 'Newport', 'North Bend', 'Ontario', 'Oregon City', 'Pendleton',
    'Portland', 'Prineville', 'Redmond', 'Reedsport', 'Roseburg', 'Salem', 'Sandy', 'Scappoose', 'Seaside', 'Sherwood',
    'Springfield', 'St. Helens', 'Sweet Home', 'Talent', 'Tigard', 'Tillamook', 'Tualatin', 'West Linn', 'Wilsonville', 'Woodburn'
  ],
  'Pennsylvania': [
    'Abington', 'Aliquippa', 'Allentown', 'Altoona', 'Ambridge', 'Ardmore', 'Baldwin', 'Beaver Falls', 'Bedford', 'Bethlehem',
    'Bethel Park', 'Birdsboro', 'Blair', 'Bloomsburg', 'Blue Bell', 'Boyertown', 'Bradford', 'Bristol', 'Brookhaven', 'Butler',
    'Camp Hill', 'Canonsburg', 'Carbondale', 'Carlisle', 'Carnegie', 'Chambersburg', 'Chester', 'Clarion', 'Clearfield', 'Coatesville',
    'Collegeville', 'Columbia', 'Conshohocken', 'Coraopolis', 'Coudersport', 'Cranberry Township', 'Cresson', 'Danville', 'Darby', 'Doylestown',
    'DuBois', 'Dunmore', 'Easton', 'Erie', 'Ephrata', 'Erie', 'Exton', 'Fairless Hills', 'Farrell', 'Franklin',
    'Franklin Park', 'Gettysburg', 'Greensburg', 'Greenville', 'Grove City', 'Hanover', 'Harrisburg', 'Hazleton', 'Hermitage', 'Hershey',
    'Hollidaysburg', 'Homestead', 'Horsham', 'Huntingdon', 'Indiana', 'Jeannette', 'Johnstown', 'Kennett Square', 'King of Prussia', 'Kittanning',
    'Lancaster', 'Lansdale', 'Lansdowne', 'Latrobe', 'Lebanon', 'Levittown', 'Lewistown', 'Ligonier', 'Lima', 'Lock Haven',
    'Lower Burrell', 'Lower Merion', 'McKeesport', 'McKees Rocks', 'Meadville', 'Media', 'Middletown', 'Monaca', 'Monessen', 'Monroeville',
    'Montgomeryville', 'Morrisville', 'Mount Joy', 'Mount Pleasant', 'Munhall', 'Murrysville', 'Nanticoke', 'Nazareth', 'New Castle', 'New Kensington',
    'Newtown', 'Norristown', 'Northampton', 'Northumberland', 'Oil City', 'Old Forge', 'Palmyra', 'Parker', 'Pen Argyl', 'Penn Hills',
    'Perkasie', 'Philadelphia', 'Phoenixville', 'Pittsburgh', 'Pittston', 'Plymouth Meeting', 'Pottstown', 'Pottsville', 'Punxsutawney', 'Quakertown',
    'Reading', 'Red Lion', 'Ridley Park', 'Robesonia', 'Royersford', 'Saint Marys', 'Scranton', 'Shamokin', 'Sharon', 'Shippensburg',
    'Somerset', 'South Williamsport', 'Springfield', 'State College', 'Stroudsburg', 'Sunbury', 'Swarthmore', 'Tamaqua', 'Titusville', 'Towanda',
    'Tunkhannock', 'Uniontown', 'Upper Darby', 'Upper Providence', 'Vandergrift', 'Warren', 'Washington', 'Waynesboro', 'West Chester', 'West Mifflin',
    'West Reading', 'Whitehall', 'Wilkes-Barre', 'Williamsport', 'Willow Grove', 'Windber', 'Womelsdorf', 'Wyomissing', 'York', 'Youngwood'
  ],
  'Rhode Island': [
    'Barrington', 'Bristol', 'Burrillville', 'Central Falls', 'Charlestown', 'Coventry', 'Cranston', 'Cumberland', 'East Greenwich', 'East Providence',
    'Exeter', 'Foster', 'Glocester', 'Hopkinton', 'Jamestown', 'Johnston', 'Lincoln', 'Little Compton', 'Middletown', 'Narragansett',
    'New Shoreham', 'Newport', 'North Kingstown', 'North Providence', 'North Smithfield', 'Pawtucket', 'Portsmouth', 'Providence', 'Richmond', 'Scituate',
    'Smithfield', 'South Kingstown', 'Tiverton', 'Warren', 'Warwick', 'Westerly', 'West Greenwich', 'West Warwick', 'Woonsocket'
  ],
  'South Carolina': [
    'Abbeville', 'Aiken', 'Anderson', 'Bamberg', 'Barnwell', 'Beaufort', 'Belton', 'Bennettsville', 'Bishopville', 'Blacksburg',
    'Bluffton', 'Camden', 'Cayce', 'Central', 'Charleston', 'Cheraw', 'Chesnee', 'Chester', 'Clemson', 'Clinton',
    'Columbia', 'Conway', 'Darlington', 'Dillon', 'Easley', 'Edgefield', 'Florence', 'Fort Mill', 'Fountain Inn', 'Gaffney',
    'Georgetown', 'Goose Creek', 'Greenville', 'Greenwood', 'Greer', 'Hampton', 'Hartsville', 'Hilton Head Island', 'Irmo', 'Kingstree',
    'Ladson', 'Lake City', 'Lancaster', 'Laurens', 'Lexington', 'Liberty', 'Manning', 'Mauldin', 'Moncks Corner', 'Mount Pleasant',
    'Mullins', 'Myrtle Beach', 'Newberry', 'North Augusta', 'North Charleston', 'Orangeburg', 'Pendleton', 'Pickens', 'Ridgeland', 'Rock Hill',
    'Seneca', 'Simpsonville', 'Spartanburg', 'Summerville', 'Sumter', 'Taylors', 'Travelers Rest', 'Union', 'Walhalla', 'Walterboro',
    'West Columbia', 'Westminster', 'Williamston', 'York'
  ],
  'South Dakota': [
    'Aberdeen', 'Brookings', 'Huron', 'Mitchell', 'Pierre', 'Rapid City', 'Sioux Falls', 'Vermillion', 'Watertown', 'Yankton'
  ],
  'Tennessee': [
    'Alcoa', 'Athens', 'Bartlett', 'Bristol', 'Brownsville', 'Chattanooga', 'Clarksville', 'Cleveland', 'Collierville', 'Columbia',
    'Cookeville', 'Crossville', 'Dickson', 'Dyersburg', 'East Ridge', 'Elizabethton', 'Farragut', 'Franklin', 'Gallatin', 'Germantown',
    'Goodlettsville', 'Greeneville', 'Hendersonville', 'Jackson', 'Jefferson City', 'Johnson City', 'Kingsport', 'Knoxville', 'Lebanon', 'Lewisburg',
    'Lynchburg', 'McMinnville', 'Manchester', 'Martin', 'Maryville', 'Memphis', 'Morristown', 'Mount Juliet', 'Murfreesboro', 'Nashville',
    'Oak Ridge', 'Paris', 'Pigeon Forge', 'Pulaski', 'Red Bank', 'Ripley', 'Sevierville', 'Shelbyville', 'Smyrna', 'Spring Hill',
    'Springfield', 'Tullahoma', 'Union City', 'White House'
  ],
  'Texas': [
    'Abilene', 'Addison', 'Adrian', 'Agua Dulce', 'Alamo', 'Alamo Heights', 'Albany', 'Alice', 'Allen', 'Alpine',
    'Alto', 'Alvarado', 'Alvin', 'Amarillo', 'Anahuac', 'Anderson', 'Andrews', 'Angleton', 'Anna', 'Anson',
    'Anthony', 'Aransas Pass', 'Archer City', 'Argyle', 'Arlington', 'Arp', 'Athens', 'Atlanta', 'Aubrey', 'Austin',
    'Azle', 'Bacliff', 'Bailey', 'Baird', 'Balch Springs', 'Ballinger', 'Balmorhea', 'Bandera', 'Bangs', 'Bardwell',
    'Barry', 'Barstow', 'Bartlett', 'Bastrop', 'Bay City', 'Bayou Vista', 'Baytown', 'Beach City', 'Beaumont', 'Bedford',
    'Bee Cave', 'Beeville', 'Bellaire', 'Belton', 'Benbrook', 'Big Lake', 'Big Spring', 'Bishop', 'Blanco', 'Blooming Grove',
    'Bloomington', 'Blossom', 'Blue Mound', 'Boerne', 'Bogata', 'Bonham', 'Booker', 'Borger', 'Bovina', 'Bowie',
    'Boyd', 'Brackettville', 'Brady', 'Brazoria', 'Brazos Country', 'Breckenridge', 'Brenham', 'Bridge City', 'Bridgeport', 'Brookshire',
    'Brookside Village', 'Brownfield', 'Brownsboro', 'Brownsville', 'Brownwood', 'Bruceville-Eddy', 'Bryan', 'Buffalo', 'Burkburnett', 'Burleson',
    'Burnet', 'Caddo Mills', 'Caldwell', 'Calvert', 'Cameron', 'Camp Wood', 'Canadian', 'Canton', 'Canyon', 'Canyon Lake',
    'Carrollton', 'Carthage', 'Castroville', 'Cedar Hill', 'Cedar Park', 'Celina', 'Center', 'Centerville', 'Chandler', 'Channelview',
    'Childress', 'China', 'Cibolo', 'Cisco', 'Clarksville', 'Cleburne', 'Cleveland', 'Clute', 'Clyde', 'Coldspring',
    'Coleman', 'College Station', 'Colleyville', 'Colorado City', 'Columbus', 'Comanche', 'Combes', 'Commerce', 'Conroe', 'Converse',
    'Coppell', 'Copperas Cove', 'Corinth', 'Corpus Christi', 'Corsicana', 'Cotulla', 'Crandall', 'Crane', 'Crockett', 'Crosby',
    'Crosbyton', 'Cross Plains', 'Crowell', 'Crowley', 'Crystal City', 'Cuero', 'Cumby', 'Cypress', 'Daingerfield', 'Dallas',
    'Dalhart', 'Danbury', 'Dayton', 'De Kalb', 'De Leon', 'Decatur', 'Deer Park', 'Del Rio', 'Denison', 'Denton',
    'Denver City', 'DeSoto', 'Detroit', 'Devine', 'Diboll', 'Dickinson', 'Dilley', 'Donna', 'Dripping Springs', 'Dublin',
    'Dumas', 'Duncanville', 'Eagle Lake', 'Eagle Pass', 'Early', 'East Bernard', 'Eastland', 'Edcouch', 'Eden', 'Edinburg',
    'Edna', 'El Campo', 'El Paso', 'Elgin', 'Elsa', 'Emory', 'Ennis', 'Euless', 'Eustace', 'Evadale',
    'Fairfield', 'Falfurrias', 'Falls City', 'Farmers Branch', 'Farmersville', 'Fate', 'Fayetteville', 'Floresville', 'Flower Mound', 'Forest Hill',
    'Forney', 'Fort Stockton', 'Fort Worth', 'Franklin', 'Fredericksburg', 'Freeport', 'Friendswood', 'Frisco', 'Fritch', 'Fulshear',
    'Gainesville', 'Galena Park', 'Galveston', 'Garland', 'Gatesville', 'Georgetown', 'Giddings', 'Gilmer', 'Gladewater', 'Glenn Heights',
    'Glen Rose', 'Godley', 'Goldthwaite', 'Goliad', 'Gonzales', 'Gordon', 'Graham', 'Granbury', 'Grand Prairie', 'Grand Saline',
    'Grandview', 'Grapevine', 'Greenville', 'Gregory', 'Groves', 'Gun Barrel City', 'Hallettsville', 'Haltom City', 'Hamilton', 'Harker Heights',
    'Harlingen', 'Haskell', 'Haslet', 'Hearne', 'Heath', 'Hempstead', 'Henderson', 'Hereford', 'Hewitt', 'Hidalgo',
    'Highland Park', 'Highland Village', 'Hillsboro', 'Hitchcock', 'Hondo', 'Houston', 'Humble', 'Huntsville', 'Hurst', 'Hutchins',
    'Hutto', 'Ingleside', 'Iowa Park', 'Irving', 'Italy', 'Jacinto City', 'Jacksonville', 'Jasper', 'Jersey Village', 'Jewett',
    'Johnson City', 'Jollyville', 'Joshua', 'Junction', 'Justin', 'Katy', 'Kaufman', 'Keller', 'Kemah', 'Kemp',
    'Kempner', 'Kenedy', 'Kennedale', 'Kerrville', 'Kilgore', 'Killeen', 'Kingsville', 'Kingwood', 'Kirby', 'Kyle',
    'La Feria', 'La Grange', 'La Marque', 'La Porte', 'Lackland AFB', 'Lago Vista', 'Lake Dallas', 'Lake Jackson', 'Lake Worth', 'Lamesa',
    'Lampasas', 'Lancaster', 'Laredo', 'League City', 'Leander', 'Leon Valley', 'Lewisville', 'Liberty', 'Lindale', 'Little Elm',
    'Live Oak', 'Livingston', 'Llano', 'Lockhart', 'Lockney', 'Lone Star', 'Longview', 'Lubbock', 'Lufkin', 'Luling',
    'Lumberton', 'Lytle', 'Madisonville', 'Magnolia', 'Malakoff', 'Manor', 'Mansfield', 'Marble Falls', 'Marlin', 'Marshall',
    'McAllen', 'McKinney', 'McQueeney', 'Meadows Place', 'Melissa', 'Mercedes', 'Mesquite', 'Mexia', 'Midland', 'Midlothian',
    'Mineola', 'Mineral Wells', 'Mission', 'Missouri City', 'Monahans', 'Mont Belvieu', 'Montgomery', 'Moody', 'Morgan\'s Point', 'Mount Pleasant',
    'Mount Vernon', 'Muenster', 'Murphy', 'Nacogdoches', 'Nassau Bay', 'Nederland', 'New Braunfels', 'New Caney', 'New Deal', 'New Summerfield',
    'Nocona', 'North Richland Hills', 'Northlake', 'Oak Point', 'Oak Ridge North', 'Odessa', 'Old River-Winfree', 'Orange', 'Overton', 'Palestine',
    'Palmview', 'Pampa', 'Paris', 'Pasadena', 'Pearland', 'Pearsall', 'Pecos', 'Perryton', 'Pflugerville', 'Pharr',
    'Pilot Point', 'Pinehurst', 'Plainview', 'Plano', 'Pleasanton', 'Point', 'Port Arthur', 'Port Lavaca', 'Port Neches', 'Portland',
    'Post', 'Prairie View', 'Princeton', 'Prosper', 'Quinlan', 'Raymondville', 'Red Oak', 'Refugio', 'Richardson', 'Richmond',
    'Rio Grande City', 'River Oaks', 'Robinson', 'Robstown', 'Rockdale', 'Rockport', 'Rockwall', 'Roma', 'Rosenberg', 'Round Rock',
    'Rowlett', 'Royse City', 'Sachse', 'Saginaw', 'Saint Jo', 'San Angelo', 'San Antonio', 'San Benito', 'San Elizario', 'San Juan',
    'San Marcos', 'San Saba', 'Sanger', 'Santa Fe', 'Schertz', 'Seabrook', 'Seagoville', 'Sealy', 'Seguin', 'Selma',
    'Shallowater', 'Shamrock', 'Sheppard AFB', 'Sherman', 'Silsbee', 'Sinton', 'Slaton', 'Smithville', 'Snyder', 'Socorro',
    'South Houston', 'Southlake', 'South Padre Island', 'Spearman', 'Spring', 'Springtown', 'Stafford', 'Stephenville', 'Stinnett', 'Sugar Land',
    'Sulphur Springs', 'Sweetwater', 'Tahoka', 'Temple', 'Terrell', 'Texarkana', 'Texas City', 'The Colony', 'The Woodlands', 'Tomball',
    'Trophy Club', 'Tyler', 'Universal City', 'University Park', 'Uvalde', 'Valley Mills', 'Van', 'Vernon', 'Victoria', 'Vidor',
    'Waco', 'Wake Village', 'Waller', 'Watauga', 'Waxahachie', 'Weatherford', 'Webster', 'Wells', 'Weslaco', 'West Columbia',
    'West Lake Hills', 'West Orange', 'West University Place', 'Westlake', 'Westworth Village', 'Wharton', 'White Oak', 'White Settlement', 'Whitehouse', 'Wichita Falls',
    'Willis', 'Wills Point', 'Wimberley', 'Windcrest', 'Winnsboro', 'Wolfforth', 'Woodway', 'Wylie', 'Yoakum', 'Zapata'
  ],
  'Utah': [
    'Alpine', 'American Fork', 'Bountiful', 'Brigham City', 'Cedar City', 'Centerville', 'Clearfield', 'Clinton', 'Cottonwood Heights', 'Draper',
    'Eagle Mountain', 'Farmington', 'Herriman', 'Highland', 'Holladay', 'Kaysville', 'Layton', 'Lehi', 'Logan', 'Midvale',
    'Millcreek', 'Murray', 'North Logan', 'North Ogden', 'North Salt Lake', 'Ogden', 'Orem', 'Payson', 'Pleasant Grove', 'Pleasant View',
    'Provo', 'Riverton', 'Roy', 'Salt Lake City', 'Sandy', 'Santaquin', 'Saratoga Springs', 'South Jordan', 'South Ogden', 'South Salt Lake',
    'Spanish Fork', 'Springville', 'St. George', 'Syracuse', 'Taylorsville', 'Tooele', 'Vernal', 'Washington', 'West Jordan', 'West Valley City',
    'Woods Cross'
  ],
  'Vermont': [
    'Barre', 'Bellows Falls', 'Bennington', 'Bethel', 'Brandon', 'Brattleboro', 'Brighton', 'Bristol', 'Burlington', 'Castleton',
    'Colchester', 'Danville', 'Derby', 'Enosburg', 'Essex Junction', 'Fair Haven', 'Hardwick', 'Hartford', 'Highgate', 'Hyde Park',
    'Island Pond', 'Johnson', 'Ludlow', 'Lyndon', 'Manchester', 'Middlebury', 'Milton', 'Montpelier', 'Morrisville', 'Newport',
    'North Bennington', 'Northfield', 'Norwich', 'Poultney', 'Randolph', 'Richford', 'Rutland', 'St. Albans', 'St. Johnsbury', 'Shelburne',
    'South Burlington', 'Springfield', 'Stowe', 'Swanton', 'Vergennes', 'Waterbury', 'White River Junction', 'Williston', 'Winooski', 'Woodstock'
  ],
  'Virginia': [
    'Abingdon', 'Alexandria', 'Altavista', 'Amherst', 'Annandale', 'Arlington', 'Ashburn', 'Ashland', 'Bedford', 'Blacksburg',
    'Bluemont', 'Bristol', 'Buena Vista', 'Burke', 'Cape Charles', 'Centreville', 'Chantilly', 'Charlottesville', 'Chesapeake', 'Chester',
    'Christiansburg', 'Clifton', 'Colonial Heights', 'Covington', 'Culpeper', 'Danville', 'Dumfries', 'Dunn Loring', 'Emporia', 'Fairfax',
    'Falls Church', 'Farmville', 'Fishersville', 'Floyd', 'Forest', 'Fort Belvoir', 'Fort Lee', 'Franklin', 'Fredericksburg', 'Front Royal',
    'Gainesville', 'Galax', 'Gloucester', 'Gordonsville', 'Great Falls', 'Grottoes', 'Hampton', 'Harrisonburg', 'Haymarket', 'Herndon',
    'Hopewell', 'Hot Springs', 'Huntington', 'Independence', 'Irvington', 'Kilmarnock', 'Leesburg', 'Lexington', 'Lorton', 'Lovettsville',
    'Lynchburg', 'Manassas', 'Manassas Park', 'Martinsville', 'McLean', 'Mechanicsville', 'Merrifield', 'Middleburg', 'Midlothian', 'Montclair',
    'Mount Vernon', 'New Market', 'Newport News', 'Norfolk', 'Oakton', 'Onley', 'Orange', 'Palmyra', 'Petersburg', 'Poquoson',
    'Portsmouth', 'Pulaski', 'Purcellville', 'Radford', 'Reston', 'Richmond', 'Roanoke', 'Salem', 'Saluda', 'Smithfield',
    'South Boston', 'Springfield', 'Stafford', 'Staunton', 'Sterling', 'Strasburg', 'Suffolk', 'Tappahannock', 'Tazewell', 'Timberville',
    'Tuckahoe', 'Vienna', 'Virginia Beach', 'Warrenton', 'Waynesboro', 'Williamsburg', 'Winchester', 'Wise', 'Woodbridge', 'Wytheville'
  ],
  'Washington': [
    'Aberdeen', 'Airway Heights', 'Algona', 'Anacortes', 'Arlington', 'Auburn', 'Bainbridge Island', 'Battle Ground', 'Bellevue', 'Bellingham',
    'Benton City', 'Bothell', 'Bremerton', 'Burien', 'Burlington', 'Camas', 'Carnation', 'Cashmere', 'Centralia', 'Chehalis',
    'Cheney', 'Cle Elum', 'Clyde Hill', 'Colfax', 'College Place', 'Colville', 'Connell', 'Cosmopolis', 'Covington', 'Des Moines',
    'DuPont', 'Duvall', 'East Wenatchee', 'Edmonds', 'Ellensburg', 'Enumclaw', 'Ephrata', 'Everett', 'Federal Way', 'Ferndale',
    'Fife', 'Fircrest', 'Forks', 'Gig Harbor', 'Goldendale', 'Grandview', 'Hoquiam', 'Issaquah', 'Kenmore', 'Kennewick',
    'Kent', 'Kirkland', 'Lacey', 'Lake Forest Park', 'Lake Stevens', 'Lakewood', 'Langley', 'Leavenworth', 'Liberty Lake', 'Longview',
    'Lynden', 'Lynnwood', 'Mabton', 'Maple Valley', 'Marysville', 'Mercer Island', 'Mill Creek', 'Monroe', 'Moses Lake', 'Mount Vernon',
    'Mountlake Terrace', 'Mukilteo', 'Newcastle', 'Newport', 'Normandy Park', 'North Bend', 'Oak Harbor', 'Ocean Shores', 'Olympia', 'Omak',
    'Othello', 'Pacific', 'Pasco', 'Port Angeles', 'Port Orchard', 'Port Townsend', 'Poulsbo', 'Prosser', 'Pullman', 'Puyallup',
    'Quincy', 'Redmond', 'Renton', 'Richland', 'Ridgefield', 'Sammamish', 'SeaTac', 'Seattle', 'Sedro-Woolley', 'Selah',
    'Sequim', 'Shelton', 'Shoreline', 'Snohomish', 'Snoqualmie', 'Spokane', 'Spokane Valley', 'Stanwood', 'Steilacoom', 'Sumner',
    'Tacoma', 'Tumwater', 'Union Gap', 'University Place', 'Vancouver', 'Walla Walla', 'Wapato', 'Washougal', 'Wenatchee', 'West Richland',
    'Westport', 'White Salmon', 'Woodinville', 'Woodland', 'Yakima', 'Yelm'
  ],
  'West Virginia': [
    'Beckley', 'Bluefield', 'Bridgeport', 'Charleston', 'Clarksburg', 'Dunbar', 'Elkins', 'Fairmont', 'Grafton', 'Huntington',
    'Keyser', 'Lewisburg', 'Logan', 'Martinsburg', 'Morgantown', 'Moundsville', 'New Martinsville', 'Nitro', 'Oak Hill', 'Parkersburg',
    'Parsons', 'Philippi', 'Point Pleasant', 'Princeton', 'Ravenswood', 'Ripley', 'Romney', 'Salem', 'Shepherdstown', 'South Charleston',
    'St. Albans', 'St. Marys', 'Summersville', 'Vienna', 'Weirton', 'Welch', 'Wellsburg', 'Weston', 'Wheeling', 'Williamson'
  ],
  'Wisconsin': [
    'Altoona', 'Antigo', 'Appleton', 'Ashland', 'Baraboo', 'Barron', 'Beaver Dam', 'Beloit', 'Berlin', 'Black River Falls',
    'Blair', 'Bloomer', 'Boscobel', 'Brodhead', 'Brookfield', 'Burlington', 'Cedarburg', 'Chippewa Falls', 'Clintonville', 'Columbus',
    'Cudahy', 'Cumberland', 'De Pere', 'DeForest', 'Delavan', 'Eau Claire', 'Elkhorn', 'Elroy', 'Evansville', 'Fond du Lac',
    'Fort Atkinson', 'Fox Lake', 'Franklin', 'Galesville', 'Germantown', 'Glendale', 'Green Bay', 'Greenfield', 'Hartford', 'Hayward',
    'Hudson', 'Hurley', 'Janesville', 'Jefferson', 'Juneau', 'Kenosha', 'Kewaskum', 'Kewaunee', 'La Crosse', 'Lake Geneva',
    'Lancaster', 'Lodi', 'Madison', 'Manitowoc', 'Marinette', 'Marshfield', 'Mauston', 'Medford', 'Menasha', 'Menomonie',
    'Merrill', 'Middleton', 'Milwaukee', 'Mineral Point', 'Monroe', 'Mount Horeb', 'Muskego', 'Neenah', 'New Berlin', 'New Glarus',
    'New London', 'New Richmond', 'North Fond du Lac', 'North Prairie', 'Oak Creek', 'Oconomowoc', 'Oconto', 'Onalaska', 'Oshkosh', 'Peshtigo',
    'Platteville', 'Plymouth', 'Port Washington', 'Portage', 'Prairie du Chien', 'Racine', 'Reedsburg', 'Rhinelander', 'Rice Lake', 'Richland Center',
    'Ripon', 'River Falls', 'Shawano', 'Sheboygan', 'Sheboygan Falls', 'Sparta', 'Stevens Point', 'Stoughton', 'Sturgeon Bay', 'Sun Prairie',
    'Superior', 'Tomah', 'Two Rivers', 'Viroqua', 'Washburn', 'Watertown', 'Waukesha', 'Waupaca', 'Wausau', 'Wauwatosa',
    'West Allis', 'West Bend', 'Whitewater', 'Wisconsin Rapids'
  ],
  'Wyoming': [
    'Afton', 'Alpine', 'Baggs', 'Bar Nunn', 'Basin', 'Big Piney', 'Buffalo', 'Casper', 'Cheyenne', 'Cody',
    'Cokeville', 'Cowley', 'Diamondville', 'Douglas', 'Dubois', 'Evanston', 'Gillette', 'Green River', 'Greybull', 'Jackson',
    'Kemmerer', 'Lander', 'Laramie', 'Lovell', 'Lusk', 'Lyman', 'Mountain View', 'Newcastle', 'Pine Bluffs', 'Pinedale',
    'Powell', 'Ralston', 'Rawlins', 'Riverton', 'Rock Springs', 'Saratoga', 'Sheridan', 'Shoshoni', 'Sinclair', 'Sundance',
    'Ten Sleep', 'Thermopolis', 'Torrington', 'Wheatland', 'Worland'
  ]
};

// Service category options
const serviceCategoryOptions = [
  'Automotive Repair', 'Automotive Detailing', 'Adjuster', 'Barber', 'Body Shop', 'Car Wash', 'Contractors', 'Dealership', 'Electrician', 'Electronic Device Repair',
  'HVAC Heating and Air Conditioning', 'Home cleaners', 'Hair/Nail Salon', 'Landscaping', 'Locksmith', 'Medical Services', 'Moving Services', 'Pool Cleaning Services', 'Pet Grooming', 'Plumbing', 'Painting Services', 'Pest/Exterminating Services', 'Security Installation', 'Roofing Services', 'Towing', 'Tree Services', 'Other'
];

// Service types by category
const serviceTypesByCategory: { [key: string]: string[] } = {
  'Automotive Repair': ['Engine Repair', 'Transmission Service', 'Brake Service', 'Oil Change', 'Tire Service', 'Electrical Systems', 'Diagnostic Services', 'Preventive Maintenance'],
  'Automotive Detailing': ['Interior Detailing', 'Exterior Detailing', 'Paint Correction', 'Ceramic Coating', 'Headlight Restoration', 'Odor Removal', 'Fabric Protection'],
  'Barber': ['Haircuts', 'Beard Trimming', 'Hair Styling', 'Shaving', 'Hair Coloring', 'Consultation'],
  'Contractors': ['General Contracting', 'Kitchen Remodeling', 'Bathroom Remodeling', 'Deck Building', 'Fence Installation', 'Drywall', 'Painting', 'Flooring'],
  'Electrician': ['Electrical Installation', 'Electrical Repair', 'Lighting Installation', 'Panel Upgrades', 'Emergency Services', 'Commercial Electrical', 'Residential Electrical'],
  'HVAC Heating and Air Conditioning': ['AC Installation', 'AC Repair', 'Heating Installation', 'Heating Repair', 'Maintenance', 'Duct Cleaning', 'Thermostat Installation'],
  'Home cleaners': ['Regular Cleaning', 'Deep Cleaning', 'Move-in/Move-out Cleaning', 'Post-construction Cleaning', 'Carpet Cleaning', 'Window Cleaning', 'Pressure Washing'],
  'Hair/Nail Salon': ['Haircuts', 'Hair Coloring', 'Hair Styling', 'Manicures', 'Pedicures', 'Nail Art', 'Hair Treatments', 'Extensions'],
  'Landscaping': ['Lawn Maintenance', 'Landscape Design', 'Tree Planting', 'Irrigation Systems', 'Hardscaping', 'Garden Design', 'Seasonal Cleanup'],
  'Locksmith': ['Lock Installation', 'Lock Repair', 'Key Duplication', 'Emergency Services', 'Security Systems', 'Safe Services'],
  'Medical Services': ['Primary Care', 'Specialty Care', 'Diagnostic Services', 'Preventive Care', 'Emergency Services'],
  'Moving Services': ['Residential Moving', 'Commercial Moving', 'Packing Services', 'Storage Solutions', 'Furniture Assembly', 'Long-distance Moving'],
  'Pool Cleaning Services': ['Regular Cleaning', 'Chemical Balancing', 'Equipment Repair', 'Pool Opening/Closing', 'Algae Treatment', 'Filter Cleaning'],
  'Pet Grooming': ['Dog Grooming', 'Cat Grooming', 'Bathing', 'Haircuts', 'Nail Trimming', 'Ear Cleaning', 'Flea Treatment'],
  'Plumbing': ['Pipe Repair', 'Fixture Installation', 'Drain Cleaning', 'Water Heater Services', 'Emergency Plumbing', 'Commercial Plumbing'],
  'Painting Services': ['Interior Painting', 'Exterior Painting', 'Commercial Painting', 'Cabinet Painting', 'Deck Staining', 'Wallpaper Installation'],
  'Pest/Exterminating Services': ['Pest Control', 'Termite Treatment', 'Rodent Control', 'Bed Bug Treatment', 'Preventive Services', 'Commercial Pest Control'],
  'Security Installation': ['Security Systems', 'CCTV Installation', 'Access Control', 'Alarm Systems', 'Monitoring Services', 'Commercial Security'],
  'Roofing Services': ['Roof Installation', 'Roof Repair', 'Roof Inspection', 'Gutter Services', 'Skylight Installation', 'Emergency Repairs'],
  'Towing': ['Emergency Towing', 'Long-distance Towing', 'Roadside Assistance', 'Vehicle Recovery', 'Commercial Towing'],
  'Tree Services': ['Tree Removal', 'Tree Trimming', 'Stump Grinding', 'Emergency Tree Services', 'Tree Planting', 'Arborist Services']
};

// Specializations by category
const specializationsByCategory: { [key: string]: string[] } = {
  'Adjuster': ['Property Claims', 'Auto Claims', 'Liability Claims', 'Public Adjusting', 'Catastrophe Response', 'Appraisal Support'],
  'Automotive Repair': ['German Cars', 'Japanese Cars', 'American Cars', 'Hybrid/Electric', 'Classic Cars', 'Performance Tuning', 'Diesel Engines'],
  'Automotive Detailing': ['Luxury Vehicles', 'Classic Cars', 'Motorcycles', 'Boats', 'RVs', 'Commercial Vehicles'],
  'Barber': ['Classic Cuts', 'Modern Styles', 'Beard Specialist', 'Hair Color Specialist', 'Kids Cuts', 'Senior Cuts'],
  'Body Shop': ['Collision Repair', 'Paint Matching', 'Dent Removal', 'Frame Straightening', 'Insurance Repair', 'Bumper Repair'],
  'Car Wash': ['Exterior Wash', 'Interior Cleaning', 'Mobile Service', 'Fleet Service', 'Wax and Protect', 'Ceramic Coating'],
  'Contractors': ['Kitchen Specialist', 'Bathroom Specialist', 'Outdoor Living', 'Historic Restoration', 'Green Building', 'Accessibility'],
  'Dealership': ['New Vehicles', 'Used Vehicles', 'Trade-In Appraisals', 'Finance Support', 'Commercial Sales', 'Service Department'],
  'Electrician': ['Residential', 'Commercial', 'Industrial', 'Emergency Services', 'Smart Home', 'Solar Installation'],
  'Electronic Device Repair': ['Phone Repair', 'Tablet Repair', 'Laptop Repair', 'Screen Replacement', 'Battery Service', 'Data Recovery'],
  'HVAC Heating and Air Conditioning': ['Residential', 'Commercial', 'Industrial', 'Heat Pumps', 'Geothermal', 'Ductless Systems'],
  'Home cleaners': ['Residential', 'Commercial', 'Eco-friendly', 'Post-construction', 'Move-in/Move-out', 'Regular Maintenance'],
  'Hair/Nail Salon': ['Hair Color', 'Hair Extensions', 'Nail Art', 'Gel Manicures', 'Acrylic Nails', 'Hair Treatments'],
  'Landscaping': ['Residential', 'Commercial', 'Sustainable Design', 'Water Features', 'Outdoor Lighting', 'Seasonal Maintenance'],
  'Locksmith': ['Residential', 'Commercial', 'Automotive', 'Emergency Services', 'Security Systems', 'Safe Services'],
  'Medical Services': ['Primary Care', 'Specialty Care', 'Preventive Medicine', 'Emergency Care', 'Telemedicine'],
  'Moving Services': ['Residential', 'Commercial', 'Long-distance', 'International', 'Storage Solutions', 'Specialty Items'],
  'Pool Cleaning Services': ['Residential', 'Commercial', 'Salt Water Pools', 'Fiberglass Pools', 'Concrete Pools', 'Hot Tubs'],
  'Pet Grooming': ['Dogs', 'Cats', 'Small Animals', 'Show Grooming', 'Mobile Services', 'Specialty Breeds'],
  'Plumbing': ['Residential', 'Commercial', 'Emergency Services', 'Water Heaters', 'Sewer Lines', 'Gas Lines'],
  'Painting Services': ['Interior', 'Exterior', 'Commercial', 'Residential', 'Cabinet Painting', 'Deck Staining'],
  'Pest/Exterminating Services': ['Residential', 'Commercial', 'Organic Methods', 'Emergency Services', 'Preventive Programs'],
  'Security Installation': ['Residential', 'Commercial', 'CCTV', 'Access Control', 'Monitoring', 'Emergency Systems'],
  'Roofing Services': ['Asphalt Shingles', 'Metal Roofing', 'Tile Roofing', 'Flat Roofs', 'Emergency Repairs', 'Maintenance'],
  'Towing': ['Light Duty', 'Heavy Duty', 'Emergency Services', 'Long Distance', 'Specialty Vehicles', 'Roadside Assistance'],
  'Tree Services': ['Tree Removal', 'Tree Trimming', 'Emergency Services', 'Arborist Services', 'Stump Grinding', 'Tree Planting']
};

// Helper functions
const getServiceTypesForCategory = (category: string) => {
  const configured = getServiceTemplatesForCategory(category).map((template) => template.name);
  if (configured.length > 0) return configured;
  return serviceTypesByCategory[category] || [];
};

const getSpecializationsForCategory = (category: string) => {
  return specializationsByCategory[category] || [];
};

// Benefits lists
const userBenefits = [
  'Find trusted local service providers',
  'Read verified customer reviews',
  'Book appointments instantly',
  'Get competitive quotes',
  '24/7 customer support',
  'Secure payment processing'
];

const vendorBenefits = [
  'Grow your business with new customers',
  'Manage bookings and schedules easily',
  'Get paid quickly and securely',
  'Build your online reputation',
  'Access business tools and analytics',
  'Dedicated support team'
];

// Response time options
const responseTimeOptions = [
  'Within 1 hour',
  'Within 2 hours', 
  'Within 4 hours',
  'Within 8 hours',
  'Within 24 hours',
  'Within 48 hours',
  'Within 1 week'
];

// Generate reCAPTCHA token function
const generateRecaptchaToken = () => {
  // For development, return a mock token
  // In production, this would integrate with reCAPTCHA
  return 'mock-recaptcha-token-' + Date.now();
};

function RegisterPageInner() {
  type CustomServiceDraft = {
    id: string;
    name: string;
    defaultDuration: string;
    price: string;
    description: string;
  };
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams?.get('type') as 'vendor' | 'user';
  const safeNextPath = sanitizeAuthNextPath(searchParams?.get('next'));
  const loginHref = appendAuthNext('/auth/login', safeNextPath);
  const entryBackHref = getAuthEntryBackHref(safeNextPath);
  const entryBackLabel = getAuthEntryBackLabel(safeNextPath);
  const entryDescription = getAuthEntryDescription('register', safeNextPath);

  // State management
  const [userType, setUserType] = useState<'user' | 'vendor'>(type || 'user');
  const addressRequired = userType === 'vendor';
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [otherBusinessType, setOtherBusinessType] = useState('');
  const [serviceTypeCustomNames, setServiceTypeCustomNames] = useState<Record<string, string>>({});
  const [serviceTypeDetails, setServiceTypeDetails] = useState<Record<string, TemplateServiceDetailDraft>>({});
  const [customServices, setCustomServices] = useState<CustomServiceDraft[]>([]);
  const [customServicesError, setCustomServicesError] = useState('');
  const registerIntroCopy =
    userType === 'vendor'
      ? 'Create your vendor account and launch your dashboard.'
      : entryDescription || 'Create your account and start your journey';

  // City autocomplete states
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [selectedCityIndex, setSelectedCityIndex] = useState(-1);

  // Form data state
  const [formData, setFormData] = useState(createInitialRegisterFormData);
  const yearsInBusinessPreview = useMemo(() => {
    const foundedYear = Number.parseInt(String(formData.foundedYear || '').trim(), 10);
    const currentYear = new Date().getFullYear();
    if (!Number.isFinite(foundedYear) || foundedYear < 1900 || foundedYear > currentYear) {
      return '';
    }
    return String(Math.max(0, currentYear - foundedYear));
  }, [formData.foundedYear]);
  const availableServiceTypes = useMemo(
    () => (formData.category ? getServiceTypesForCategory(formData.category) : []),
    [formData.category]
  );
  const availableSpecializations = useMemo(
    () => (formData.category ? getSpecializationsForCategory(formData.category) : []),
    [formData.category]
  );

  // Error state
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    meetsRequirements: false,
    feedback: ''
  });

  // Check for success state on mount
  useEffect(() => {
    const success = sessionStorage.getItem('registrationSuccess');
    if (success) {
      setSubmitSuccess(success);
      sessionStorage.removeItem('registrationSuccess');
    }
  }, []);

  // Update userType when type param changes
  useEffect(() => {
    if (type) {
      setUserType(type);
    }
  }, [type]);

  const switchUserType = (nextUserType: 'user' | 'vendor') => {
    if (nextUserType === userType) return;

    setUserType(nextUserType);
    setStep(1);
    setSubmitError('');
    setSubmitSuccess('');
    setErrors({});
    setRecaptchaToken('');
    setOtherBusinessType('');
    setServiceTypeCustomNames({});
    setServiceTypeDetails({});
    setCustomServices([]);
    setCustomServicesError('');
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setSelectedCityIndex(-1);
    setFormData((current) => getRegisterFormDataForRoleSwitch(current, nextUserType));

    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('type', nextUserType);
    router.replace(`/auth/register?${params.toString()}`, { scroll: false });
  };

  // Password strength calculation
  useEffect(() => {
    if (formData.password) {
      const password = formData.password;
      let score = 0;
      const feedback = [];

      if (password.length >= 8) score++;
      else feedback.push('at least 8 characters');

      if (/[a-z]/.test(password)) score++;
      else feedback.push('at least one lowercase letter');

      if (/[A-Z]/.test(password)) score++;
      else feedback.push('at least one uppercase letter');

      if (/\d/.test(password)) score++;
      else feedback.push('at least one number');

      if (/[^A-Za-z0-9]/.test(password)) score++;
      else feedback.push('at least one special character');

      setPasswordStrength({
        score,
        meetsRequirements: score >= 4,
        feedback: feedback.join(', ')
      });
    } else {
      setPasswordStrength({
        score: 0,
        meetsRequirements: false,
        feedback: ''
      });
    }
  }, [formData.password]);

  // Handler functions
  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCityInput = (value: string) => {
    handleInputChange('city', value);
    
    if (value.length >= 2 && formData.state) {
      const cities = getCitiesForState(formData.state);
      const filtered = cities.filter(city => 
        city.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10);
      setCitySuggestions(filtered);
      setShowCitySuggestions(filtered.length > 0);
      setSelectedCityIndex(-1);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  };

  const selectCity = (city: string) => {
    handleInputChange('city', city);
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setSelectedCityIndex(-1);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCityIndex(prev => 
        prev < citySuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCityIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedCityIndex >= 0) {
      e.preventDefault();
      selectCity(citySuggestions[selectedCityIndex]);
    } else if (e.key === 'Escape') {
      setShowCitySuggestions(false);
      setSelectedCityIndex(-1);
    }
  };

  const handleStateChange = (value: string) => {
    handleInputChange('state', value);
    handleInputChange('city', '');
    setCitySuggestions([]);
    setShowCitySuggestions(false);
    setSelectedCityIndex(-1);
  };

  const getCitiesForState = (state: string) => {
    return CITIES_BY_STATE[state] || [];
  };

  const validateStep1 = () => {
    const newErrors: {[key: string]: string} = {};

    // Required field validation
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address (e.g., user@example.com)';
    
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number (e.g., 555-123-4567)';
    }

    if (!formData.password) newErrors.password = 'Password is required';
    else if (!passwordStrength.meetsRequirements) {
      newErrors.password = `Password must meet all requirements: ${passwordStrength.feedback}`;
    }

    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match. Please make sure both passwords are identical.';
    }

    // Vendor addresses are required for local service discovery and verification.
    // Customer addresses stay optional at signup and can be managed later in profile settings.
    if (addressRequired) {
      if (!formData.address.trim()) newErrors.address = 'Street address is required for vendor registration';
      if (!formData.city.trim()) newErrors.city = 'City is required for vendor registration';
      if (!formData.state.trim()) newErrors.state = 'Please select your state';
      if (!formData.zipCode.trim()) newErrors.zipCode = 'ZIP code is required for vendor registration';
    }
    if (formData.zipCode.trim()) {
      const zipValidation = validateZipCodeForState(formData.zipCode, formData.state);
      if (!zipValidation.isValid) {
        newErrors.zipCode = zipValidation.message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    if (userType === 'user') return true; // User step 2 is just review

    const newErrors: {[key: string]: string} = {};

    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!formData.businessType.trim()) newErrors.businessType = 'Business type is required';
    if (formData.businessType === 'Other' && !otherBusinessType.trim()) newErrors.businessType = 'Please specify your business type';
    if (!formData.category.trim()) newErrors.category = 'Primary service category is required (e.g., Cleaning, Plumbing, Design)';
    if (!formData.businessBio.trim()) newErrors.businessBio = 'Business description is required';
    
    if (!formData.foundedYear) newErrors.foundedYear = 'Founded year is required';
    else {
      const currentYear = new Date().getFullYear();
      const foundedYear = parseInt(formData.foundedYear);
      if (foundedYear < 1900 || foundedYear > currentYear) {
        newErrors.foundedYear = `Founded year must be between 1900 and ${currentYear}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Starting registration process...');
    
    if (!validateStep2()) {
      console.log('Step 2 validation failed');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(''); // Clear any previous errors
    setSubmitSuccess(''); // Clear any previous success messages

    try {
      console.log('Attempting to generate reCAPTCHA token...');
      // Try to generate reCAPTCHA token, but don't fail if it's not available
      let token = '';
      try {
        token = await generateRecaptchaToken();
        setRecaptchaToken(token);
        console.log('reCAPTCHA token generated successfully');
      } catch (recaptchaError) {
        console.warn('reCAPTCHA not available:', recaptchaError);
        // Continue without reCAPTCHA token for development
      }

      // Prepare registration data with proper type conversions
      const selectedTemplateServices = buildSelectedTemplateServices({
        category: formData.category,
        serviceTypes: Array.isArray(formData.serviceTypes) ? formData.serviceTypes : [],
        nameOverrides: serviceTypeCustomNames,
        detailDrafts: serviceTypeDetails,
      });
      const selectedCustomServices = customServices
        .map((service) => ({
          name: service.name.trim(),
          defaultDuration: service.defaultDuration.trim() ? Number(service.defaultDuration) : undefined,
          price: service.price.trim() ? Number(service.price) : undefined,
          description: service.description.trim() || undefined,
          source: 'vendor_custom',
        }))
        .filter((service) => service.name);
      const normalizedNames = [
        ...selectedTemplateServices.map((service: any) => String(service?.name || '').toLowerCase()),
        ...selectedCustomServices.map((service) => String(service.name || '').toLowerCase()),
      ].filter(Boolean);
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        setCustomServicesError('Duplicate service names are not allowed across template and custom services.');
        setIsSubmitting(false);
        return;
      }
      setCustomServicesError('');

      const registrationData = {
        ...formData,
        // Convert arrays to comma-separated strings
        serviceTypes: Array.isArray(formData.serviceTypes)
          ? formData.serviceTypes
              .map((serviceType) => String(serviceTypeCustomNames[serviceType] || serviceType).trim())
              .filter(Boolean)
              .join(', ')
          : formData.serviceTypes,
        specializations: Array.isArray(formData.specializations) ? formData.specializations.join(', ') : formData.specializations,
        serviceAreas: Array.isArray(formData.serviceAreas) ? formData.serviceAreas.join(', ') : formData.serviceAreas,
        selectedServices: [...selectedTemplateServices, ...selectedCustomServices],
        // Convert booleans to strings
        insuranceStatus: String(formData.insuranceStatus),
        bondingStatus: String(formData.bondingStatus),
        userType,
        recaptchaToken: token // Include reCAPTCHA token if available
      };

      console.log('Registration data prepared:', { ...registrationData, password: '[HIDDEN]' });

      // Determine the correct API endpoint based on user type
      const apiEndpoint = userType === 'vendor' ? '/api/vendor/register' : '/api/customer/register';
      console.log('Making API call to:', apiEndpoint);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      console.log('API response status:', response.status);
      const data = await response.json();
      console.log('API response data:', data);

      if (response.ok) {
        console.log('Registration successful, redirecting...');
        // Clear any existing errors
        setErrors({});
        setSubmitError('');
        setSubmitSuccess('Account created successfully! Redirecting...');
        
        // Registration creates the account, but does not create a signed-in session.
        // Send the user to login with a truthful next step instead of a protected dashboard.
        console.log('About to redirect to login after registration. userType:', userType);

        sessionStorage.setItem(
          'registrationSuccess',
          userType === 'vendor'
            ? 'Vendor account created. Verify your email, then sign in to continue vendor setup.'
            : 'Account created. Verify your email, then sign in to continue.'
        );
        sessionStorage.setItem('registrationUserType', userType);

        const loginParams = new URLSearchParams();
        loginParams.set('registered', '1');
        loginParams.set('role', userType);
        if (typeof registrationData.email === 'string' && registrationData.email.trim()) {
          loginParams.set('email', registrationData.email.trim());
        }
        if (safeNextPath) {
          loginParams.set('next', safeNextPath);
        }
        const loginRedirect = `/auth/login?${loginParams.toString()}`;
        console.log('Redirecting to', loginRedirect);
        router.replace(loginRedirect);
        setTimeout(() => {
          window.location.href = loginRedirect;
        }, 1000);
      } else {
        console.log('Registration failed with status:', response.status);
        // Handle different types of errors
        if (response.status === 400) {
          // Validation errors from backend
          if (data.error) {
            setSubmitError(data.error);
          } else {
            setSubmitError('Please check your information and try again.');
          }
        } else if (response.status === 429) {
          setSubmitError('Too many registration attempts. Please wait a moment and try again.');
        } else {
          setSubmitError(data.error || 'Registration failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle different types of network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setSubmitError('Network error. Please check your internet connection and try again.');
      } else if (error instanceof Error && error.message.includes('reCAPTCHA')) {
        setSubmitError('reCAPTCHA verification failed. Please refresh the page and try again.');
      } else {
        setSubmitError('An unexpected error occurred. Please try again.');
      }
    } finally {
      console.log('Registration process completed, setting isSubmitting to false');
      setIsSubmitting(false);
    }
  };

  const userBenefits = [
    "Browse local professionals in your area",
    "Read authentic customer reviews",
    "View vendor video profiles",
    "Contact vendors directly",
    "Save your favorite professionals"
  ];

  const vendorBenefits = [
    "Create your professional profile",
    "Showcase your services with video",
    "Get discovered by local customers",
    "Build your online reputation",
    "Access customer reviews and feedback"
  ];

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score >= 4) return 'text-green-600';
    if (passwordStrength.score >= 3) return 'text-yellow-600';
    if (passwordStrength.score >= 2) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get service areas based on selected state
  const getServiceAreasForState = (state: string) => {
    const serviceAreasByState: { [key: string]: string[] } = {
      'Florida': [
        'Downtown Orlando', 'Winter Park', 'Maitland', 'Altamonte Springs', 'Longwood', 'Lake Mary', 'Sanford', 'Oviedo', 'Winter Springs', 'Casselberry',
        'Downtown Miami', 'Brickell', 'Coral Gables', 'Coconut Grove', 'South Beach', 'North Miami Beach', 'Aventura', 'Doral', 'Kendall', 'West Kendall',
        'Downtown Tampa', 'Ybor City', 'Hyde Park', 'South Tampa', 'Westshore', 'Carrollwood', 'New Tampa', 'Brandon', 'Riverview', 'Wesley Chapel',
        'Downtown Jacksonville', 'Riverside', 'Avondale', 'San Marco', 'Beaches', 'Mandarin', 'Orange Park', 'Fleming Island', 'Ponte Vedra', 'Atlantic Beach',
        'Downtown Fort Lauderdale', 'Las Olas', 'Victoria Park', 'Flagler Village', 'Wilton Manors', 'Oakland Park', 'Pompano Beach', 'Deerfield Beach', 'Boca Raton', 'Delray Beach'
      ],
      'California': [
        'Downtown Los Angeles', 'Hollywood', 'Beverly Hills', 'West Hollywood', 'Santa Monica', 'Venice', 'Marina del Rey', 'Culver City', 'Brentwood', 'Bel Air',
        'Downtown San Francisco', 'North Beach', 'Fisherman\'s Wharf', 'Chinatown', 'Mission District', 'Castro District', 'Haight-Ashbury', 'Pacific Heights', 'Marina District', 'Russian Hill',
        'Downtown San Diego', 'Gaslamp Quarter', 'Little Italy', 'North Park', 'South Park', 'Hillcrest', 'La Jolla', 'Coronado', 'Point Loma', 'Pacific Beach',
        'Downtown Sacramento', 'Midtown', 'East Sacramento', 'Land Park', 'Curtis Park', 'Tahoe Park', 'Arden-Arcade', 'Carmichael', 'Fair Oaks', 'Folsom'
      ],
      'New York': [
        'Downtown Manhattan', 'Midtown Manhattan', 'Upper East Side', 'Upper West Side', 'Harlem', 'East Village', 'West Village', 'Chelsea', 'Greenwich Village', 'SoHo',
        'Brooklyn Heights', 'Williamsburg', 'DUMBO', 'Park Slope', 'Prospect Heights', 'Crown Heights', 'Bedford-Stuyvesant', 'Bushwick', 'Greenpoint', 'Bay Ridge',
        'Astoria', 'Long Island City', 'Jackson Heights', 'Forest Hills', 'Flushing', 'Bayside', 'Fresh Meadows', 'Jamaica', 'Queens Village', 'Rockaway',
        'Riverdale', 'Fordham', 'Pelham Bay', 'Throgs Neck', 'Morris Park', 'Pelham Parkway', 'Williamsbridge', 'Wakefield', 'Co-op City', 'City Island'
      ],
      'Texas': [
        'Downtown Houston', 'Midtown', 'Montrose', 'Heights', 'Rice Village', 'Museum District', 'Medical Center', 'Galleria', 'Uptown', 'River Oaks',
        'Downtown Dallas', 'Uptown', 'Deep Ellum', 'Oak Cliff', 'Lakewood', 'Highland Park', 'University Park', 'Preston Hollow', 'North Dallas', 'Plano',
        'Downtown Austin', 'East Austin', 'West Austin', 'South Austin', 'North Austin', 'Hyde Park', 'Clarksville', 'Tarrytown', 'Westlake', 'Lake Travis'
      ],
      'Illinois': [
        'Downtown Chicago', 'Loop', 'River North', 'Gold Coast', 'Streeterville', 'Old Town', 'Lincoln Park', 'Lakeview', 'Wrigleyville', 'Bucktown',
        'Wicker Park', 'Logan Square', 'Humboldt Park', 'Pilsen', 'Bridgeport', 'Hyde Park', 'Kenwood', 'Bronzeville', 'South Loop', 'West Loop'
      ],
      'Massachusetts': [
        'Downtown Boston', 'Back Bay', 'Beacon Hill', 'North End', 'South End', 'Charlestown', 'East Boston', 'Allston', 'Brighton', 'Jamaica Plain',
        'Cambridge', 'Somerville', 'Medford', 'Arlington', 'Belmont', 'Watertown', 'Newton', 'Brookline', 'Waltham', 'Lexington'
      ],
      'Pennsylvania': [
        'Center City Philadelphia', 'Old City', 'Society Hill', 'Queen Village', 'Bella Vista', 'Graduate Hospital', 'Rittenhouse Square', 'Washington Square West', 'Logan Square', 'Fairmount',
        'Manayunk', 'Roxborough', 'Chestnut Hill', 'Mount Airy', 'Germantown', 'Fishtown', 'Northern Liberties', 'Kensington', 'Port Richmond', 'South Philadelphia'
      ],
      'Ohio': [
        'Downtown Columbus', 'Short North', 'German Village', 'Brewery District', 'Victorian Village', 'Clintonville', 'Worthington', 'Upper Arlington', 'Grandview Heights', 'Bexley',
        'Downtown Cleveland', 'Tremont', 'Ohio City', 'Detroit-Shoreway', 'Gordon Square', 'University Circle', 'Little Italy', 'Coventry Village', 'Cleveland Heights', 'Lakewood'
      ],
      'Michigan': [
        'Downtown Detroit', 'Midtown', 'Corktown', 'Mexicantown', 'Rivertown', 'New Center', 'Woodbridge', 'Lafayette Park', 'Indian Village', 'Palmer Park',
        'Downtown Grand Rapids', 'Heritage Hill', 'Eastown', 'East Grand Rapids', 'Cascade', 'Ada', 'Forest Hills', 'Kentwood', 'Wyoming', 'Hudsonville'
      ],
      'Georgia': [
        'Downtown Atlanta', 'Midtown', 'Buckhead', 'Virginia-Highland', 'Inman Park', 'Old Fourth Ward', 'Grant Park', 'Cabbagetown', 'East Atlanta Village', 'Little Five Points',
        'Decatur', 'Sandy Springs', 'Roswell', 'Alpharetta', 'Marietta', 'Smyrna', 'Vinings', 'Brookhaven', 'Chamblee', 'Dunwoody'
      ],
      'North Carolina': [
        'Downtown Charlotte', 'Uptown', 'South End', 'NoDa', 'Plaza Midwood', 'Myers Park', 'Dilworth', 'Elizabeth', 'Chantilly', 'Eastover',
        'Downtown Raleigh', 'North Hills', 'Cameron Village', 'Five Points', 'Oakwood', 'Boylan Heights', 'Mordecai', 'Glenwood South', 'Warehouse District', 'Cary'
      ],
      'Virginia': [
        'Downtown Richmond', 'Fan District', 'Museum District', 'Carytown', 'Shockoe Bottom', 'Shockoe Slip', 'Jackson Ward', 'Church Hill', 'Forest Hill', 'Westover Hills',
        'Old Town Alexandria', 'Del Ray', 'Rosemont', 'Braddock Heights', 'Beverly Hills', 'Arlandria', 'Potomac Yard', 'Crystal City', 'Arlington', 'McLean'
      ],
      'Washington': [
        'Downtown Seattle', 'Capitol Hill', 'Belltown', 'South Lake Union', 'Queen Anne', 'Fremont', 'Ballard', 'Green Lake', 'Wallingford', 'University District',
        'Downtown Bellevue', 'Kirkland', 'Redmond', 'Sammamish', 'Issaquah', 'Mercer Island', 'Newcastle', 'Renton', 'Kent', 'Auburn'
      ],
      'Arizona': [
        'Downtown Phoenix', 'Roosevelt Row', 'Arcadia', 'Biltmore', 'Camelback East', 'Ahwatukee', 'South Mountain', 'Laveen', 'Maryvale', 'North Mountain',
        'Downtown Scottsdale', 'Old Town', 'McCormick Ranch', 'Kierland', 'DC Ranch', 'Gainey Ranch', 'Pinnacle Peak', 'Desert Mountain', 'Troon', 'Carefree'
      ],
      'Colorado': [
        'Downtown Denver', 'LoDo', 'RiNo', 'Five Points', 'Capitol Hill', 'Cheesman Park', 'Congress Park', 'City Park', 'Park Hill', 'Stapleton',
        'Downtown Boulder', 'Pearl Street', 'University Hill', 'Gunbarrel', 'Table Mesa', 'Chautauqua', 'Flagstaff', 'Nederland', 'Louisville', 'Lafayette'
      ]
    };

    return serviceAreasByState[state] || [
      'Downtown', 'Midtown', 'Uptown', 'East Side', 'West Side', 'North Side', 'South Side', 'Central District', 'Historic District', 'Business District'
    ];
  };

  // Comprehensive ZIP code validation function
  const validateZipCodeForState = (zipCode: string, state: string) => {
    // Basic ZIP code format validation (5 digits)
    if (!/^\d{5}$/.test(zipCode)) {
      return { isValid: false, message: 'ZIP code must be 5 digits' };
    }

    // ZIP code ranges by state (comprehensive coverage)
    const zipRangesByState: { [key: string]: { start: string; end: string; }[] } = {
      'Alabama': [
        { start: '35004', end: '36925' }
      ],
      'Alaska': [
        { start: '99501', end: '99950' }
      ],
      'Arizona': [
        { start: '85001', end: '86556' }
      ],
      'Arkansas': [
        { start: '71601', end: '72959' }
      ],
      'California': [
        { start: '90001', end: '96162' }
      ],
      'Colorado': [
        { start: '80001', end: '81658' }
      ],
      'Connecticut': [
        { start: '06001', end: '06928' }
      ],
      'Delaware': [
        { start: '19701', end: '19980' }
      ],
      'Florida': [
        { start: '32004', end: '34997' }
      ],
      'Georgia': [
        { start: '30001', end: '31999' },
        { start: '39813', end: '39899' }
      ],
      'Hawaii': [
        { start: '96701', end: '96898' }
      ],
      'Idaho': [
        { start: '83201', end: '83876' }
      ],
      'Illinois': [
        { start: '60001', end: '62999' }
      ],
      'Indiana': [
        { start: '46001', end: '47997' }
      ],
      'Iowa': [
        { start: '50001', end: '52809' }
      ],
      'Kansas': [
        { start: '66002', end: '67954' }
      ],
      'Kentucky': [
        { start: '40003', end: '42788' }
      ],
      'Louisiana': [
        { start: '70001', end: '71497' }
      ],
      'Maine': [
        { start: '03901', end: '04992' }
      ],
      'Maryland': [
        { start: '20331', end: '21930' }
      ],
      'Massachusetts': [
        { start: '01001', end: '02791' }
      ],
      'Michigan': [
        { start: '48001', end: '49971' }
      ],
      'Minnesota': [
        { start: '55001', end: '56763' }
      ],
      'Mississippi': [
        { start: '38601', end: '39776' }
      ],
      'Missouri': [
        { start: '63001', end: '65899' }
      ],
      'Montana': [
        { start: '59001', end: '59937' }
      ],
      'Nebraska': [
        { start: '68001', end: '69367' }
      ],
      'Nevada': [
        { start: '88901', end: '89883' }
      ],
      'New Hampshire': [
        { start: '03031', end: '03897' }
      ],
      'New Jersey': [
        { start: '07001', end: '08989' }
      ],
      'New Mexico': [
        { start: '87001', end: '88439' }
      ],
      'New York': [
        { start: '10001', end: '14975' }
      ],
      'North Carolina': [
        { start: '27006', end: '28909' }
      ],
      'North Dakota': [
        { start: '58001', end: '58856' }
      ],
      'Ohio': [
        { start: '43001', end: '45999' }
      ],
      'Oklahoma': [
        { start: '73001', end: '74966' }
      ],
      'Oregon': [
        { start: '97001', end: '97920' }
      ],
      'Pennsylvania': [
        { start: '15001', end: '19640' }
      ],
      'Rhode Island': [
        { start: '02801', end: '02940' }
      ],
      'South Carolina': [
        { start: '29001', end: '29948' }
      ],
      'South Dakota': [
        { start: '57001', end: '57799' }
      ],
      'Tennessee': [
        { start: '37010', end: '38589' }
      ],
      'Texas': [
        { start: '75001', end: '79999' },
        { start: '88510', end: '88595' }
      ],
      'Utah': [
        { start: '84001', end: '84784' }
      ],
      'Vermont': [
        { start: '05001', end: '05907' }
      ],
      'Virginia': [
        { start: '20101', end: '24658' }
      ],
      'Washington': [
        { start: '98001', end: '99403' }
      ],
      'West Virginia': [
        { start: '24701', end: '26886' }
      ],
      'Wisconsin': [
        { start: '53001', end: '54990' }
      ],
      'Wyoming': [
        { start: '82001', end: '83128' }
      ]
    };

    const stateRanges = zipRangesByState[state];
    if (!stateRanges) {
      return { isValid: false, message: `ZIP code validation not available for ${state}` };
    }

    // Check if ZIP code falls within any of the state's ranges
    const zipNum = parseInt(zipCode, 10);
    const isValidForState = stateRanges.some(range => {
      const startNum = parseInt(range.start, 10);
      const endNum = parseInt(range.end, 10);
      return zipNum >= startNum && zipNum <= endNum;
    });

    if (!isValidForState) {
      return { 
        isValid: false, 
        message: `ZIP code ${zipCode} is not valid for ${state}. Please enter a valid ZIP code for ${state}.` 
      };
    }

    return { isValid: true, message: 'ZIP code is valid for the selected state' };
  };

  return (
    <div className="reliance-marketplace-shell min-h-screen bg-[var(--reliance-paper)] py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(17,24,39,0.94))] px-8 py-9 text-center text-white shadow-[0_32px_90px_rgba(2,6,23,0.36)]">
          <Link href={entryBackHref} className="mb-4 inline-flex items-center text-blue-200 transition hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {entryBackLabel}
          </Link>
          <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">
            Join Reliance
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-blue-100/86 sm:text-base">
            {registerIntroCopy}
          </p>
        </div>

        {/* User Type Toggle */}
        <div className="flex justify-center mb-8">
          <div className="rounded-full border border-white/10 bg-slate-950/80 p-1 shadow-[0_18px_45px_rgba(2,6,23,0.32)] backdrop-blur">
            <button
              onClick={() => switchUserType('user')}
              className={`rounded-full px-6 py-3 font-medium transition-all ${
                userType === 'user'
                  ? 'bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserIcon className="inline h-4 w-4 mr-2" />
              I Need Services
            </button>
            <button
              onClick={() => switchUserType('vendor')}
              className={`rounded-full px-6 py-3 font-medium transition-all ${
                userType === 'vendor'
                  ? 'bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Shield className="inline h-4 w-4 mr-2" />
              I Provide Services
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Registration Form */}
          <Card className="reliance-light-card rounded-[30px] border border-slate-200 shadow-xl">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  userType === 'user' ? 'bg-blue-100' : 'bg-purple-100'
                }`}>
                  {userType === 'user' ? (
                    <UserIcon className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Shield className="h-5 w-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl">
                    {userType === 'user' ? 'Customer Registration' : 'Vendor Registration'}
                  </CardTitle>
                  <CardDescription>
                    {userType === 'user' ? 'Join to find services' : 'Join to provide services'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex justify-end">
                <TutorialEntryPoint
                  guide={userType === 'vendor' ? tutorialGuides.vendorRegistration : tutorialGuides.customerRegistration}
                  surface="light"
                />
              </div>
                             <form onSubmit={handleSubmit} className="space-y-4">
                 {/* Hidden reCAPTCHA token field */}
                 <input 
                   type="hidden" 
                   name="recaptchaToken" 
                   value={recaptchaToken} 
                 />

                 {/* Submit Error Display */}
                 {submitError && (
                   <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                     <div className="flex items-center">
                       <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                       <div>
                         <h4 className="text-sm font-medium text-red-800">Registration Error</h4>
                         <p className="text-sm text-red-700 mt-1">{submitError}</p>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Submit Success Display */}
                 {submitSuccess && (
                   <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                     <div className="flex items-center">
                       <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                       <div>
                         <h4 className="text-sm font-medium text-green-800">Success!</h4>
                         <p className="text-sm text-green-700 mt-1">{submitSuccess}</p>
                       </div>
                     </div>
                   </div>
                 )}

                {/* Step Indicator */}
                <div className="mb-6">
                  <div className="flex items-center justify-center space-x-4">
                    <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        1
                      </div>
                      <span className="ml-2 text-sm font-medium">Personal Information</span>
                    </div>
                    {userType === 'vendor' && (
                      <>
                        <div className="w-8 h-1 bg-gray-200 rounded"></div>
                        <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                            2
                          </div>
                          <span className="ml-2 text-sm font-medium">Business Information</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Step 1: Basic Information */}
                {step === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className={errors.firstName ? 'border-red-500' : ''}
                          required
                        />
                        {errors.firstName && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.firstName}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className={errors.lastName ? 'border-red-500' : ''}
                          required
                        />
                        {errors.lastName && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={errors.email ? 'border-red-500' : ''}
                        required
                      />
                      {errors.email && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.email}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={errors.phone ? 'border-red-500' : ''}
                        placeholder="(555) 123-4567"
                        required
                      />
                      {errors.phone && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    {/* Address Fields */}
                    <div>
                      <Label htmlFor="address">
                        Street Address {addressRequired ? '*' : <span className="text-gray-500">(optional)</span>}
                      </Label>
                      <Input
                        id="address"
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        className={errors.address ? 'border-red-500' : ''}
                        placeholder={addressRequired ? '123 Main St' : 'Optional at signup'}
                        required={addressRequired}
                      />
                      {!addressRequired && (
                        <p className="text-xs text-gray-500 mt-1">
                          Add this later in Profile Settings to support future local discovery.
                        </p>
                      )}
                      {errors.address && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.address}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative">
                        <Label htmlFor="city">
                          City {addressRequired ? '*' : <span className="text-gray-500">(optional)</span>}
                        </Label>
                        <Input
                          id="city"
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleCityInput(e.target.value)}
                          onKeyDown={handleCityKeyDown}
                          onFocus={() => {
                            if (formData.city.length >= 2 && formData.state) {
                              const cities = getCitiesForState(formData.state);
                              const filtered = cities.filter(city => 
                                city.toLowerCase().includes(formData.city.toLowerCase())
                              ).slice(0, 10);
                              setCitySuggestions(filtered);
                              setShowCitySuggestions(filtered.length > 0);
                            }
                          }}
                          onBlur={() => {
                            // Delay hiding suggestions to allow for clicks
                            setTimeout(() => setShowCitySuggestions(false), 200);
                          }}
                          disabled={!formData.state}
                          placeholder={formData.state ? "Type to search cities..." : addressRequired ? "Select state first" : "Optional"}
                          className={errors.city ? 'border-red-500' : ''}
                        />
                        
                        {/* City suggestions dropdown */}
                        {showCitySuggestions && citySuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {citySuggestions.map((city, index) => (
                              <div
                                key={city}
                                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                                  index === selectedCityIndex ? 'bg-blue-100' : ''
                                }`}
                                onClick={() => selectCity(city)}
                                onMouseEnter={() => setSelectedCityIndex(index)}
                              >
                                {city}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {errors.city && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.city}
                          </p>
                        )}
                        {!formData.state && addressRequired && (
                          <p className="text-xs text-gray-500 mt-1">
                            Please select a state first
                          </p>
                        )}
                        {formData.state && (
                          <p className="text-xs text-gray-500 mt-1">
                            Type to search cities in {formData.state}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="state">
                          State {addressRequired ? '*' : <span className="text-gray-500">(optional)</span>}
                        </Label>
                        <Select
                          value={formData.state}
                          onValueChange={(value) => handleStateChange(value)}
                        >
                          <SelectTrigger className={errors.state ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select a state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.state && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.state}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="zipCode">
                          ZIP Code {addressRequired ? '*' : <span className="text-gray-500">(optional)</span>}
                        </Label>
                        <Input
                          id="zipCode"
                          type="text"
                          value={formData.zipCode}
                          onChange={(e) => handleInputChange('zipCode', e.target.value)}
                          className={errors.zipCode ? 'border-red-500' : ''}
                          required={addressRequired}
                        />
                        {errors.zipCode && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.zipCode}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bio for both users and vendors */}
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={userType === 'user' ? 
                          "Tell us about yourself and what services you're looking for..." : 
                          "Tell customers about your business, experience, and what makes you unique..."
                        }
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.password}
                        </p>
                      )}
                      {/* Password strength indicator */}
                      {formData.password && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">Password Strength:</span>
                            <span className={`text-sm font-medium ${getPasswordStrengthColor()}`}>
                              {passwordStrength.score >= 4 ? 'Strong' : 
                               passwordStrength.score >= 3 ? 'Good' : 
                               passwordStrength.score >= 2 ? 'Fair' : 'Weak'}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                passwordStrength.score >= 4 ? 'bg-green-500' :
                                passwordStrength.score >= 3 ? 'bg-yellow-500' :
                                passwordStrength.score >= 2 ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{width: `${(passwordStrength.score / 5) * 100}%`}}
                            ></div>
                          </div>
                          {passwordStrength.feedback && (
                            <p className="text-xs text-gray-600 mt-1">
                              Requirements: {passwordStrength.feedback}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                    
                    {userType === 'vendor' && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Next: Business Information</h4>
                        <p className="text-sm text-blue-700">
                          You'll need to provide: Business Name, Service Types, Business Description, 
                          Specializations, Service Areas, and more details about your business.
                        </p>
                      </div>
                    )}
                    
                    <Button 
                      type="button" 
                      onClick={handleNextStep} 
                      className="w-full"
                      disabled={!formData.firstName || !formData.lastName || !formData.email || 
                               !formData.password || !formData.confirmPassword || !passwordStrength.meetsRequirements}
                    >
                      {userType === 'vendor' ? 'Next: Business Information' : 'Next Step'}
                    </Button>
                  </>
                )}

                {/* Step 2: Business Information (Vendor only) */}
                {step === 2 && userType === 'vendor' && (
                  <>
                    <div>
                      <Label htmlFor="businessName">Business Name *</Label>
                      <Input
                        id="businessName"
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => handleInputChange('businessName', e.target.value)}
                        className={errors.businessName ? 'border-red-500' : ''}
                        required
                      />
                      {errors.businessName && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.businessName}
                        </p>
                      )}
                    </div>

                    {/* Profile Photo Upload */}
                    <div>
                      <Label htmlFor="profilePhoto">Business Profile Photo</Label>
                      <div className="mt-2">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            {formData.profilePhoto ? (
                              <img 
                                src={formData.profilePhoto} 
                                alt="Profile preview" 
                                className="w-20 h-20 rounded-lg object-cover border-2 border-gray-200"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                                <User className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => document.getElementById('profilePhotoInput')?.click()}
                              className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
                            >
                              <User className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex-1">
                            <input
                              id="profilePhotoInput"
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (e) => {
                                    handleInputChange('profilePhoto', e.target?.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                            <p className="text-sm text-gray-600 mb-2">
                              Upload a professional photo of your business, team, or workspace
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('profilePhotoInput')?.click()}
                            >
                              Choose Photo
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="businessType">Business Type *</Label>
                        <Select value={formData.businessType} onValueChange={(value) => {
                          handleInputChange('businessType', value);
                          if (value !== 'Other') {
                            setOtherBusinessType('');
                          }
                        }}>
                          <SelectTrigger className={errors.businessType ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select your business structure" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                            <SelectItem value="Limited Liability Company (LLC)">Limited Liability Company (LLC)</SelectItem>
                            <SelectItem value="Corporation (C-Corp)">Corporation (C-Corp)</SelectItem>
                            <SelectItem value="Corporation (S-Corp)">Corporation (S-Corp)</SelectItem>
                            <SelectItem value="Partnership (General)">Partnership (General)</SelectItem>
                            <SelectItem value="Partnership (Limited)">Partnership (Limited)</SelectItem>
                            <SelectItem value="Individual/Freelancer">Individual/Freelancer</SelectItem>
                            <SelectItem value="Family Business">Family Business</SelectItem>
                            <SelectItem value="Franchise">Franchise</SelectItem>
                            <SelectItem value="Independent Contractor">Independent Contractor</SelectItem>
                            <SelectItem value="Service Provider">Service Provider</SelectItem>
                            <SelectItem value="Non-profit Organization">Non-profit Organization</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.businessType && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.businessType}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Select the legal structure of your business
                        </p>
                        {formData.businessType === 'Other' && (
                          <div className="mt-2">
                            <Label htmlFor="businessTypeOther">Specify Business Type</Label>
                            <Input
                              id="businessTypeOther"
                              type="text"
                              value={otherBusinessType}
                              placeholder="Please specify your business type"
                              className="mt-1"
                              onChange={(e) => {
                                setOtherBusinessType(e.target.value);
                                handleInputChange('businessType', `Other: ${e.target.value}`);
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="category">Primary Service Category *</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => {
                            handleInputChange('category', value);
                            handleInputChange('serviceTypes', []);
                            handleInputChange('specializations', []);
                            setServiceTypeCustomNames({});
                            setServiceTypeDetails({});
                            setCustomServices([]);
                            setCustomServicesError('');
                          }}
                        >
                          <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select your primary service category" />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceCategoryOptions.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.category && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.category}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Service Types */}
                    <div>
                      <Label>Service Types Offered</Label>
                      <p className="text-sm text-gray-600 mb-3">
                        {formData.category ? 
                          `Select all the services your ${formData.category.toLowerCase()} business provides` : 
                          'Select your primary service category first to see relevant service types'
                        }
                      </p>
                      {formData.category ? (
                        availableServiceTypes.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                            {availableServiceTypes.map((serviceType: string) => (
                              <div key={serviceType} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={serviceType}
                                  checked={Array.isArray(formData.serviceTypes) ? formData.serviceTypes.includes(serviceType) : false}
                                  onChange={(e) => {
                                    const currentTypes = Array.isArray(formData.serviceTypes) ? formData.serviceTypes : [];
                                    if (e.target.checked) {
                                      handleInputChange('serviceTypes', [...currentTypes, serviceType]);
                                      setServiceTypeDetails((prev) =>
                                        prev[serviceType]
                                          ? prev
                                          : {
                                              ...prev,
                                              [serviceType]: getTemplateServiceDefaultDetail(formData.category, serviceType),
                                            }
                                      );
                                    } else {
                                      handleInputChange('serviceTypes', currentTypes.filter(type => type !== serviceType));
                                      setServiceTypeDetails((prev) => {
                                        const next = { ...prev };
                                        delete next[serviceType];
                                        return next;
                                      });
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor={serviceType} className="text-sm text-gray-700 cursor-pointer">
                                  {serviceTypeCustomNames[serviceType] || serviceType}
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-amber-800 text-sm">
                              Starter service types are not configured yet for this category. You can still add your own services below.
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                          <p className="text-gray-500 text-sm">Please select a service category above to see available service types</p>
                        </div>
                      )}
                      {Array.isArray(formData.serviceTypes) && formData.serviceTypes.length > 0 ? (
                        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-xs text-slate-600">
                            Optional: rename selected templates and confirm the service name, estimated duration, starting price, and customer-facing description before saving.
                          </p>
                          {formData.serviceTypes.map((serviceType) => (
                            <div key={`rename-${serviceType}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                              <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{serviceType}</Label>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-500">Service Name</Label>
                                  <Input
                                    value={serviceTypeCustomNames[serviceType] || serviceType}
                                    onChange={(e) =>
                                      setServiceTypeCustomNames((prev) => ({
                                        ...prev,
                                        [serviceType]: e.target.value,
                                      }))
                                    }
                                    placeholder="Service name"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-500">Estimated Duration (minutes)</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={serviceTypeDetails[serviceType]?.defaultDuration || ''}
                                    onChange={(e) =>
                                      setServiceTypeDetails((prev) => ({
                                        ...prev,
                                        [serviceType]: {
                                          ...(prev[serviceType] || getTemplateServiceDefaultDetail(formData.category, serviceType)),
                                          defaultDuration: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="Estimated duration"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-slate-500">Starting Price (optional)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={serviceTypeDetails[serviceType]?.price || ''}
                                    onChange={(e) =>
                                      setServiceTypeDetails((prev) => ({
                                        ...prev,
                                        [serviceType]: {
                                          ...(prev[serviceType] || getTemplateServiceDefaultDetail(formData.category, serviceType)),
                                          price: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="Starting price"
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label className="text-xs text-slate-500">Customer-Facing Description</Label>
                                  <textarea
                                    value={serviceTypeDetails[serviceType]?.description || ''}
                                    onChange={(e) =>
                                      setServiceTypeDetails((prev) => ({
                                        ...prev,
                                        [serviceType]: {
                                          ...(prev[serviceType] || getTemplateServiceDefaultDetail(formData.category, serviceType)),
                                          description: e.target.value,
                                        },
                                      }))
                                    }
                                    rows={3}
                                    placeholder="Describe what the customer can expect from this service."
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <Label className="text-sm font-medium">Custom Services</Label>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setCustomServices((prev) => [
                                ...prev,
                                {
                                  id: `custom-${Date.now()}-${prev.length}`,
                                  name: '',
                                  defaultDuration: '',
                                  price: '',
                                  description: '',
                                },
                              ])
                            }
                          >
                            + Add custom service
                          </Button>
                        </div>
                        {customServices.length === 0 ? (
                          <p className="text-xs text-gray-500">Add services not covered by templates.</p>
                        ) : (
                          <div className="space-y-3">
                            {customServices.map((service) => (
                              <div key={service.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Service Name</Label>
                                    <Input
                                      placeholder="Service name *"
                                      value={service.name}
                                      onChange={(e) =>
                                        setCustomServices((prev) =>
                                          prev.map((item) =>
                                            item.id === service.id ? { ...item, name: e.target.value } : item
                                          )
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Estimated Duration (minutes)</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="Estimated duration"
                                      value={service.defaultDuration}
                                      onChange={(e) =>
                                        setCustomServices((prev) =>
                                          prev.map((item) =>
                                            item.id === service.id
                                              ? { ...item, defaultDuration: e.target.value }
                                              : item
                                          )
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Starting Price (optional)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="Starting price"
                                      value={service.price}
                                      onChange={(e) =>
                                        setCustomServices((prev) =>
                                          prev.map((item) =>
                                            item.id === service.id ? { ...item, price: e.target.value } : item
                                          )
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <Label className="text-xs text-slate-500">Customer-Facing Description</Label>
                                    <textarea
                                      placeholder="Describe what the customer can expect from this service."
                                      value={service.description}
                                      rows={3}
                                      onChange={(e) =>
                                        setCustomServices((prev) =>
                                          prev.map((item) =>
                                            item.id === service.id
                                              ? { ...item, description: e.target.value }
                                              : item
                                          )
                                        )
                                      }
                                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="mt-2 text-xs text-red-600"
                                  onClick={() =>
                                    setCustomServices((prev) => prev.filter((item) => item.id !== service.id))
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {customServicesError ? (
                          <p className="mt-2 text-xs text-red-600">{customServicesError}</p>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Selected: {Array.isArray(formData.serviceTypes) ? formData.serviceTypes.length : 0} service types</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="foundedYear">Founded Year *</Label>
                        <Input
                          id="foundedYear"
                          type="number"
                          value={formData.foundedYear}
                          onChange={(e) => handleInputChange('foundedYear', e.target.value)}
                          className={errors.foundedYear ? 'border-red-500' : ''}
                          min="1900"
                          max={new Date().getFullYear()}
                          required
                        />
                        {errors.foundedYear && (
                          <p className="text-red-500 text-sm mt-1 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.foundedYear}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="totalEmployees">Estimated Team Size</Label>
                        <Input
                          id="totalEmployees"
                          type="number"
                          value={formData.totalEmployees}
                          onChange={(e) => handleInputChange('totalEmployees', e.target.value)}
                          min="1"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Optional. Add actual employee accounts later from the Employees workspace.
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="yearsInBusiness">Years in Business</Label>
                      <Input
                        id="yearsInBusiness"
                        type="number"
                        value={yearsInBusinessPreview}
                        readOnly
                        min="0"
                        max="100"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Calculated from the founded year so your onboarding and saved profile stay consistent.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="licenseNumber">License Number</Label>
                      <Input
                        id="licenseNumber"
                        type="text"
                        value={formData.licenseNumber}
                        onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                        placeholder="e.g., CLEAN-2019-001"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="insuranceStatus"
                          checked={formData.insuranceStatus}
                          onChange={(e) => handleInputChange('insuranceStatus', e.target.checked)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="insuranceStatus" className="text-sm font-medium text-gray-700">Insured</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="bondingStatus"
                          checked={formData.bondingStatus}
                          onChange={(e) => handleInputChange('bondingStatus', e.target.checked)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="bondingStatus" className="text-sm font-medium text-gray-700">Bonded</label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          type="url"
                          value={formData.website}
                          onChange={(e) => handleInputChange('website', e.target.value)}
                          placeholder="https://www.yourbusiness.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emergencyContact">Emergency Contact</Label>
                        <Input
                          id="emergencyContact"
                          type="tel"
                          value={formData.emergencyContact}
                          onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                          placeholder="(555) 987-6543"
                        />
                      </div>
                    </div>

                    {/* Specializations */}
                    <div>
                      <Label>Specializations</Label>
                      <p className="text-sm text-gray-600 mb-3">
                        {formData.category ? 
                          `Select your ${formData.category.toLowerCase()} business specializations` : 
                          'Select your primary service category first to see relevant specializations'
                        }
                      </p>
                      {formData.category ? (
                        availableSpecializations.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                            {availableSpecializations.map((specialization: string) => (
                              <div key={specialization} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={specialization}
                                  checked={Array.isArray(formData.specializations) ? formData.specializations.includes(specialization) : false}
                                  onChange={(e) => {
                                    const currentSpecs = Array.isArray(formData.specializations) ? formData.specializations : [];
                                    if (e.target.checked) {
                                      handleInputChange('specializations', [...currentSpecs, specialization]);
                                    } else {
                                      handleInputChange('specializations', currentSpecs.filter(spec => spec !== specialization));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor={specialization} className="text-sm text-gray-700 cursor-pointer">
                                  {specialization}
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-amber-800 text-sm">
                              Starter specializations are not configured yet for this category. You can keep onboarding moving without selecting any here.
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                          <p className="text-gray-500 text-sm">Please select a service category above to see available specializations</p>
                        </div>
                      )}
                      <p className="text-sm text-gray-500 mt-2">Selected: {Array.isArray(formData.specializations) ? formData.specializations.length : 0} specializations</p>
                    </div>

                    {/* Business Bio */}
                    <div>
                      <Label htmlFor="businessBio">Business Description *</Label>
                      <textarea
                        id="businessBio"
                        value={formData.businessBio}
                        onChange={(e) => handleInputChange('businessBio', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={4}
                        placeholder="Describe your business, services, and what makes you unique..."
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">This will be displayed on your service listings and profile page</p>
                    </div>

                    {/* Service Areas */}
                    <div>
                      <Label htmlFor="serviceAreas">Service Areas</Label>
                      <div className="space-y-3">
                        <div>
                          <Input
                            id="serviceAreas"
                            type="text"
                            value={Array.isArray(formData.serviceAreas) ? formData.serviceAreas.join(', ') : formData.serviceAreas}
                            onChange={(e) => handleInputChange('serviceAreas', e.target.value.split(',').map(area => area.trim()))}
                            placeholder="e.g., Downtown, Midtown, Upper East Side"
                          />
                          <p className="text-sm text-gray-500 mt-1">Enter areas separated by commas</p>
                        </div>
                        
                        {/* Service Radius Option */}
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="useServiceRadius"
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="useServiceRadius" className="text-sm text-gray-700">
                            I serve within a specific radius of my location
                          </label>
                        </div>
                        
                        {/* Quick Add Common Areas */}
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Quick add common areas:</p>
                          <div className="flex flex-wrap gap-2">
                            {getServiceAreasForState(formData.state).slice(0, 8).map((area) => (
                              <button
                                key={area}
                                type="button"
                                onClick={() => {
                                  const currentAreas = Array.isArray(formData.serviceAreas) ? formData.serviceAreas : [];
                                  if (!currentAreas.includes(area)) {
                                    handleInputChange('serviceAreas', [...currentAreas, area]);
                                  }
                                }}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                              >
                                + {area}
                              </button>
                            ))}
                          </div>
                          {formData.state && (
                            <p className="text-xs text-gray-500 mt-2">
                              Showing areas for {formData.state}. Change your state in Step 1 to see different areas.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Response Time & Availability */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="responseTime">Response Time</Label>
                        <Select value={formData.responseTime} onValueChange={(value) => handleInputChange('responseTime', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your typical response time" />
                          </SelectTrigger>
                          <SelectContent>
                            {responseTimeOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-gray-500 mt-1">How quickly do you typically respond to customer inquiries?</p>
                      </div>

                      {/* Availability Section */}
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <Label>Service Availability</Label>
                        <p className="mb-3 text-sm text-amber-900">Select when you're generally available to provide services.</p>
                        <div className="mb-4 rounded-lg border border-amber-300 bg-white/80 p-3 text-sm text-amber-900">
                          Reliance currently records service days, emergency coverage, and 24/7 availability here. Real daily operating hours need additional schema, API, and booking-model support before they can be added safely.
                        </div>
                        
                        {/* Days of the Week */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                            <div key={day} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`available-${day.toLowerCase()}`}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor={`available-${day.toLowerCase()}`} className="text-sm text-gray-700">
                                {day}
                              </label>
                            </div>
                          ))}
                        </div>

                        {/* Emergency Service */}
                        <div className="flex items-center space-x-3 mb-4">
                          <input
                            type="checkbox"
                            id="emergencyService"
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="emergencyService" className="text-sm text-gray-700">
                            I offer emergency services outside regular hours
                          </label>
                        </div>

                        {/* 24/7 Service */}
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="twentyFourSeven"
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="twentyFourSeven" className="text-sm text-gray-700">
                            I offer 24/7 service availability
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button 
                        type="button" 
                        onClick={() => setStep(1)} 
                        variant="outline"
                        className="flex-1"
                      >
                        Back
                      </Button>
                                             <Button 
                         type="submit" 
                         className="flex-1"
                                                disabled={!formData.businessName || !formData.businessType || !formData.category ||
                                !formData.businessBio || !formData.foundedYear || isSubmitting}
                       >
                         {isSubmitting ? (
                           <div className="flex items-center">
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                             Creating Account...
                           </div>
                         ) : (
                           'Create Account'
                         )}
                       </Button>
                    </div>
                  </>
                )}

                {/* Step 2: Final Step (User) */}
                {step === 2 && userType === 'user' && (
                  <>
                    <div className="text-center py-4">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Almost Done!</h3>
                      <p className="text-gray-600 mb-4">
                        Review your information and create your account.
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h4 className="font-semibold mb-2">Account Summary:</h4>
                      <p><strong>Name:</strong> {formData.firstName} {formData.lastName}</p>
                      <p><strong>Email:</strong> {formData.email}</p>
                      <p><strong>Phone:</strong> {formData.phone}</p>
                      <p><strong>Location:</strong> {formData.address}, {formData.city}, {formData.state} {formData.zipCode}</p>
                      {formData.bio && <p><strong>Bio:</strong> {formData.bio}</p>}
                    </div>
                    <div className="flex gap-4">
                      <Button 
                        type="button" 
                        onClick={() => setStep(1)} 
                        variant="outline"
                        className="flex-1"
                      >
                        Back
                      </Button>
                                             <Button 
                         type="submit" 
                         className="flex-1"
                         disabled={isSubmitting}
                       >
                         {isSubmitting ? (
                           <div className="flex items-center">
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                             Creating Account...
                           </div>
                         ) : (
                           'Create Account'
                         )}
                       </Button>
                    </div>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card className="reliance-light-card rounded-[30px] border border-slate-200 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl">
                Why Join Reliance?
              </CardTitle>
              <CardDescription>
                {userType === 'user' ? 'Benefits for customers' : 'Benefits for vendors'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(userType === 'user' ? userBenefits : vendorBenefits).map((benefit, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Already have an account?</h4>
                <Link href={loginHref}>
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Loading…
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
