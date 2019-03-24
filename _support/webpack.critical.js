const join = require('path').resolve
const webpack = require('webpack')

module.exports = {
  context: join(__dirname, '..'),
  entry: './_js/critical.js',
  output: {
    path: join(__dirname, '../assets/packed/'),
    filename: 'critical.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          { loader: 'babel-loader' }
        ]
      }
    ]
  },
  // stats: 'minimal',
  devtool: 'source-map',
  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production'
    })
  ]
}
