import { ImageSourcePropType } from 'react-native';

// Use require so TS doesn’t need *.png module types
const ImgLoc1BG: ImageSourcePropType = require('../../../assets/images/melaka.png');
const ImgLoc2BG: ImageSourcePropType = require('../../../assets/images/kl.png');
const ImgLoc3BG: ImageSourcePropType = require('../../../assets/images/sabah.png');
const ImgLoc4BG: ImageSourcePropType = require('../../../assets/images/melaka.png');
const ImgLoc5BG: ImageSourcePropType = require('../../../assets/images/melaka.png');
const ImgLoc6BG: ImageSourcePropType = require('../../../assets/images/melaka.png');
const ImgLoc7BG: ImageSourcePropType = require('../../../assets/images/melaka.png');

// Return ONE background image based on location
export const getBgImg = (location?: string): ImageSourcePropType => {
  switch (location) {
    case 'tigi':
      return ImgLoc7BG;
    case 'winnie':
      return ImgLoc6BG;
    case 'clionne':
      return ImgLoc5BG;
    case 'luci':
      return ImgLoc4BG;
    case 'sabah':
      return ImgLoc3BG;
    case 'kl':
      return ImgLoc2BG;
    case 'melaka':
      return ImgLoc1BG;
    default:
      return ImgLoc1BG;
  }
};
