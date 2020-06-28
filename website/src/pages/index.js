import React from 'react'
import clsx from 'clsx'
import Layout from '@theme/Layout'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import useBaseUrl from '@docusaurus/useBaseUrl'
import styles from './styles.module.css'

const features = [
  {
    title: <>Simplified DevOps</>,
    description: (
      <>
        Ship everything as a single portable program that will work smoothly on
        any PaaS or self-managed platform.
      </>
    ),
  },
  {
    title: <>Declarative format</>,
    description: (
      <>
        Define your composite service at a high-level, in a format that is
        declarative, flexible, explicit & easy-to-read.
      </>
    ),
  },
  {
    title: <>Batteries included</>,
    description: <>Includes configurable HTTP gateway</>,
  },
]

function Feature({ imageUrl, title, description }) {
  const imgUrl = useBaseUrl(imageUrl)
  return (
    <div className="col col--4">
      {imgUrl && (
        <div className="text--center">
          <img className={styles.featureImage} src={imgUrl} alt={title} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function Home() {
  const context = useDocusaurusContext()
  const { siteConfig: { title, tagline } = {} } = context
  return (
    <Layout title="Welcome" description={`${title}: ${tagline}`}>
      <header className={clsx('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <h1 className="hero__title">{title}</h1>
          <p className="hero__subtitle">{tagline}</p>
          <div className={styles.buttons}>
            <Link
              className={clsx(
                'button button--outline button--secondary button--lg',
                styles.button
              )}
              to={useBaseUrl('docs/intro')}
            >
              Introduction
            </Link>
            <Link
              className={clsx(
                'button button--outline button--secondary button--lg',
                styles.button
              )}
              to={useBaseUrl('docs/guides/getting-started')}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>
      <main>
        {features && features.length > 0 && (
          <section className={styles.features}>
            <div className="container">
              <div className="row">
                {features.map((props, idx) => (
                  <Feature key={idx} {...props} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </Layout>
  )
}

export default Home
